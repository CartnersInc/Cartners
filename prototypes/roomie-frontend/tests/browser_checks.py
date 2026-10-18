"""Browser checks for the PR. Runs two tabs as two roommates against the sample-data build.

    npm run build && npx vite preview        # serves http://localhost:4173
    pip install playwright && playwright install chromium
    python tests/browser_checks.py [url]

Screenshots are written to docs/screenshots/.
"""
import re, time
from playwright.sync_api import sync_playwright
import os, sys
SP=os.path.join(os.path.dirname(__file__), "..", "docs", "screenshots") + "/"
os.makedirs(SP, exist_ok=True)
URL=sys.argv[1] if len(sys.argv) > 1 else "http://localhost:4173"
errs=[]; results=[]
def check(name, cond, detail=""):
    results.append((name, bool(cond), detail)); print(("PASS " if cond else "FAIL ")+name+(" | "+detail if detail else ""))
def items_text(pg): return pg.inner_text(".ap-list-page")
def as_member(pg, mid):
    pg.select_option(".harness select >> nth=0", mid); pg.wait_for_selector(".ap-list-page", timeout=8000)
def wait_for(pg, fn, timeout=8):
    end=time.time()+timeout
    while time.time()<end:
        if fn(): return True
        pg.wait_for_timeout(250)
    return False
def harness(pg, label): return pg.locator(f".harness label:has-text('{label}') input")
with sync_playwright() as p:
    b=p.chromium.launch(); ctx=b.new_context(viewport={"width":1000,"height":1100})
    A=ctx.new_page(); B=ctx.new_page()
    for pg in (A,B):
        pg.on("pageerror",lambda e: errs.append(str(e)))
        pg.on("console",lambda m: errs.append(m.text) if m.type=="error" else None)
    A.goto(URL); A.evaluate("localStorage.clear()"); A.reload(); as_member(A,"m_alex")
    B.goto(URL); as_member(B,"m_sam")
    # 1 add with name only via keyboard
    A.click("#"+A.get_attribute("form[aria-label='Add an item'] input >> nth=0","id").replace(":","\\:"))
    A.keyboard.type("Coffee beans"); A.keyboard.press("Enter")
    check("Add with only a name (Enter key)", wait_for(A, lambda: "Coffee beans" in items_text(A)))
    check("Quantity defaults to 1", "Coffee beans ×" not in items_text(A))
    check("Focus returns to the item field", A.evaluate("document.activeElement.placeholder")=="Olive oil")
    # empty name validation
    A.click("button:has-text('Add to list')"); check("Empty name is rejected", "Give the item a name." in A.inner_text("form[aria-label='Add an item']"))
    # 2 start trip reusing destination
    store_val=A.input_value(".ap-inline-input"); check("Trip destination reuses last store", store_val=="QFC", store_val)
    A.select_option(".ap-inline-select","10"); A.click("button:has-text('Start trip')")
    check("Trip starts and claims items", wait_for(A, lambda: "You're shopping at QFC" in A.inner_text(".ap-run")), A.inner_text(".ap-run")[:120])
    A.screenshot(path=SP+"desktop-shopper.png", full_page=True)
    # Sam sees banner via polling
    check("Second browser gets the banner by polling", wait_for(B, lambda: B.locator(".ap-banner").count()>0 and "Alex is going to QFC" in B.inner_text(".ap-banner"), 8))
    ca=A.inner_text(".ap-run-time"); cb=B.inner_text(".ap-banner-clock")
    check("Countdown matches across browsers", cb in ca or abs(int(re.search(r"(\d+):(\d+)",ca).group(2))-int(cb.split(':')[1]))<=2, f"{ca} / {cb}")
    B.screenshot(path=SP+"desktop-banner.png", full_page=True)
    # 3 Sam adds during window -> joins trip, shopper sees New
    B.click(".ap-banner-btn"); check("Banner button moves focus to the item field", wait_for(B, lambda: B.evaluate("document.activeElement.placeholder")=="Olive oil", 3)); B.keyboard.type("Hot sauce"); B.keyboard.press("Enter")
    ok=wait_for(B, lambda: "Added Hot sauce to Alex's trip" in B.inner_text(".ap-list-page")); check("Add before cutoff joins the trip", ok, "" if ok else repr(B.inner_text(".ap-ok"))+" hot sauce listed: "+str("Hot sauce" in items_text(B))+" focus:"+B.evaluate("document.activeElement.outerHTML.slice(0,80)"))
    check("Shopper sees the new request marked", wait_for(A, lambda: "New since you started" in items_text(A), 8))
    check("Non-shopper has no Finish button", B.locator("button:has-text('Finish trip')").count()==0)
    # 4 check two bought, finish
    A.locator(".ap-items >> nth=0").locator(".ap-bought").nth(0).check(); A.wait_for_timeout(700)
    A.locator(".ap-items >> nth=0").locator(".ap-bought:not(:checked)").nth(0).check(); A.wait_for_timeout(900)
    A.click(".ap-run button:has-text('Finish trip')")
    conf=A.inner_text(".ap-confirm"); check("Finish needs no prices and says what stays", "No prices needed" in conf and "stay on the list" in conf, conf[:120])
    A.click(".ap-confirm button:has-text('Finish trip')")
    check("Finish keeps unchecked items for the next trip", wait_for(A, lambda: "stay on the list for the next trip" in A.inner_text(".ap-run") and "Needed" in items_text(A)), A.inner_text(".ap-run")[:150])
    check("Bought items move to Bought recently", "Bought recently" in items_text(A))
    # 5 no-window trip: Sam's later add waits for next trip
    A.select_option(".ap-inline-select","0"); A.click("button:has-text('Start trip')"); wait_for(A, lambda: "You're shopping" in A.inner_text(".ap-run"))
    wait_for(B, lambda: B.locator(".ap-banner").count()>0, 8)
    B.locator("form[aria-label='Add an item'] input").first.fill("Limes"); B.keyboard.press("Enter")
    check("Add after cutoff stays for the next trip", wait_for(B, lambda: "It'll wait for the next trip" in B.inner_text(".ap-list-page")))
    check("Late request is labeled for the shopper", wait_for(A, lambda: "Added after requests closed" in items_text(A), 8))
    A.click(".ap-run button:has-text('Finish trip')"); A.click(".ap-confirm button:has-text('Finish trip')"); wait_for(A, lambda: "Going shopping?" in A.inner_text(".ap-run"))
    # 5b punt: the store doesn't have an item, so the shopper moves it to the next trip
    def row(pg, name): return pg.locator(f".ap-item:has(.ap-item-name:text-is('{name}'))")
    def in_section(pg, heading, name): return pg.locator(f"section:has(h2:has-text('{heading}'))").locator(f".ap-item-name:text-is('{name}')").count()>0
    A.locator("form[aria-label='Add an item'] input").first.fill("Capers"); A.keyboard.press("Enter")
    wait_for(A, lambda: "Capers" in items_text(A))
    A.select_option(".ap-inline-select","0"); A.click("button:has-text('Start trip')"); wait_for(A, lambda: "You're shopping" in A.inner_text(".ap-run"))
    wait_for(A, lambda: in_section(A, "On your trip", "Capers"))
    A.click("[aria-label=\"Capers isn't here. Move it to the next trip\"]")
    check("Punt moves the item off the trip to the next trip", wait_for(A, lambda: in_section(A, "For the next trip", "Capers") and not in_section(A, "On your trip", "Capers")))
    check("Punted item is labeled with the store", "Not at QFC, moved to the next trip" in row(A,"Capers").inner_text())
    check("Roommate sees the punted label by polling", wait_for(B, lambda: row(B,"Capers").count()>0 and "Not at QFC, moved to the next trip" in row(B,"Capers").inner_text(), 8))
    check("Only the shopper gets punt buttons", B.locator("[aria-label*=\"isn't here\"]").count()==0 and A.locator("[aria-label*=\"isn't here\"]").count()>0)
    A.click("[aria-label='Put Capers back on this trip']")
    check("Put back returns the item to the trip without the label", wait_for(A, lambda: in_section(A, "On your trip", "Capers")) and "Not at QFC" not in row(A,"Capers").inner_text())
    A.click("[aria-label=\"Capers isn't here. Move it to the next trip\"]"); wait_for(A, lambda: in_section(A, "For the next trip", "Capers"))
    A.click(".ap-run button:has-text('Finish trip')")
    conf=A.inner_text(".ap-confirm"); check("Finish confirmation mentions the punted item", "1 item this store didn't have is already waiting for the next trip" in conf, conf[:200])
    A.click(".ap-confirm button:has-text('Finish trip')")
    check("Finish notice mentions the punted item", wait_for(A, lambda: "Going shopping?" in A.inner_text(".ap-run") and "this store didn't have" in A.inner_text(".ap-run")), A.inner_text(".ap-run")[:200])
    A.click("button:has-text('Start trip')"); wait_for(A, lambda: "You're shopping" in A.inner_text(".ap-run"))
    check("Next trip claims the punted item, labeled from last time", wait_for(A, lambda: in_section(A, "On your trip", "Capers") and "Not found at QFC last time" in row(A,"Capers").inner_text()))
    row(A,"Capers").locator(".ap-bought").check()
    def capers_punted(): return A.evaluate("""() => { const db = JSON.parse(localStorage.getItem('roomie-mock-db-v1'));
        const it = Object.values(db.data).flatMap(g => g.items).find(i => i.name === 'Capers'); return [it.status, it.punted]; }""")
    check("Buying a punted item clears the label", wait_for(A, lambda: capers_punted()==["bought", None]), str(capers_punted()))
    A.click(".ap-run button:has-text('Finish trip')"); A.click(".ap-confirm button:has-text('Finish trip')"); wait_for(A, lambda: "Going shopping?" in A.inner_text(".ap-run"))
    # 6 race: someone else starts first
    harness(A,"Someone else starts first").check()
    A.click("button:has-text('Start trip')")
    check("Losing a simultaneous start shows the real owner", wait_for(A, lambda: "just before you" in A.inner_text(".ap-run") and "Sam is shopping" in A.inner_text(".ap-run")), A.inner_text(".ap-run")[:200])
    check("Owner's trip was not replaced", wait_for(B, lambda: "You're shopping" in B.inner_text(".ap-run"), 8))
    A.screenshot(path=SP+"desktop-race.png", full_page=True)
    B.click(".ap-run button:has-text('Finish trip')"); B.click(".ap-confirm button:has-text('Finish trip')"); wait_for(B, lambda: "Going shopping?" in B.inner_text(".ap-run"))
    # 7 offline: input preserved
    harness(A,"Offline").check()
    check("Offline state is shown", wait_for(A, lambda: "Offline" in A.inner_text(".ap-sync"), 8))
    f=A.locator("form[aria-label='Add an item'] input").first; f.fill("Garlic"); A.keyboard.press("Enter")
    check("Failed add keeps what was typed", wait_for(A, lambda: "Try again" in A.inner_text("form[aria-label='Add an item']")) and f.input_value()=="Garlic")
    A.screenshot(path=SP+"desktop-offline.png", full_page=True)
    harness(A,"Offline").uncheck(); A.click("form[aria-label='Add an item'] button:has-text('Try again')")
    check("Retry after reconnecting saves once", wait_for(A, lambda: "Added Garlic" in A.inner_text(".ap-list-page")) and items_text(A).count("Garlic")==1)
    # 8 lost response replay
    A.select_option(".harness select >> nth=1","lost-response")
    A.locator("form[aria-label='Add an item'] input").first.fill("Tofu"); A.keyboard.press("Enter")
    wait_for(A, lambda: "Try again" in A.inner_text("form[aria-label='Add an item']"))
    A.click("form[aria-label='Add an item'] button:has-text('Try again')")
    check("Replayed add isn't duplicated", wait_for(A, lambda: "wasn't added twice" in A.inner_text(".ap-list-page")) and wait_for(A, lambda: items_text(A).count("Tofu")==1))
    # 9 edit conflict
    def open_details(pg, name):
        pg.locator(f".ap-item:has(.ap-item-name:text-is('{name}'))").locator(".ap-details-btn").click()
    open_details(A,"Sriracha"); open_details(B,"Sriracha")
    B.locator(".ap-edit input").nth(2).fill("Brown eggs"); B.click(".ap-edit button:has-text('Save')"); B.wait_for_timeout(900)
    A.locator(".ap-edit input").nth(2).fill("Free range"); A.click(".ap-edit button:has-text('Save')")
    check("Edit conflict is shown with their version", wait_for(A, lambda: A.locator(".ap-conflict").count()>0 and "Brown eggs" in A.inner_text(".ap-conflict")))
    check("My edit is kept during the conflict", A.locator(".ap-edit input").nth(2).input_value()=="Free range")
    A.screenshot(path=SP+"desktop-conflict.png", full_page=True)
    A.click("button:has-text('Save mine instead')")
    check("Saving mine after a conflict works", wait_for(A, lambda: "Free range" in items_text(A) and A.locator(".ap-edit").count()==0))
    # 10 group switch
    A.click(".ap-group:has-text('Friday potluck crew')")
    ok=wait_for(A, lambda: "Dana" in A.inner_text(".ap-members") and A.locator(".ap-list-page").count()>0)
    t=items_text(A) if A.locator(".ap-list-page").count() else ""
    check("Switching groups shows the other group's members and list", ok and "Tortilla chips" in t and "Eggs" not in t and "Coffee beans" not in t)
    check("Potluck trip banner appears for Alex", A.locator(".ap-banner").count()>0 and "Dana is going to Safeway" in A.inner_text(".ap-banner"))
    A.click(".ap-tab:has-text('Spending')"); wait_for(A, lambda: A.locator(".sp-expense").count()>0)
    sp=A.inner_text(".sp-page"); check("Spending switches with the group (no old balances)", "Costco" in sp and "QFC" not in sp and "$64.20" in sp)
    A.click(".ap-group:has-text('Unit 4B')"); wait_for(A, lambda: A.locator(".sp-expense").count()>0)
    sp=A.inner_text(".sp-page"); check("Switching back loads Unit 4B spending", "QFC" in sp and "$64.20" not in sp)
    A.click(".ap-tab:has-text('List')")
    # 11 server clock ahead of this device: countdown must follow server timestamps
    A.select_option(".harness select >> nth=2","120000"); A.wait_for_timeout(3500)
    A.click("button:has-text('Start trip')"); wait_for(A, lambda: "You're shopping" in A.inner_text(".ap-run")); A.wait_for_timeout(1200)
    ca=A.inner_text(".ap-run-time strong")
    def secs(x): m,s2=x.split(":"); return int(m)*60+int(s2)
    check("Countdown uses server time when the clocks disagree", 570 <= secs(ca) <= 600, f"shows {ca}; a device-only timer would show about 12:00")
    A.select_option(".harness select >> nth=2","0")
    # 12 phone
    P=ctx.new_page(); P.set_viewport_size({"width":390,"height":844}); P.on("pageerror",lambda e: errs.append(str(e)))
    P.goto(URL); as_member(P,"m_priya"); wait_for(P, lambda: P.locator(".ap-banner").count()>0, 8)
    check("Phone: no sideways scrolling", not P.evaluate("document.documentElement.scrollWidth > innerWidth"))
    dock=P.locator(".ap-dock"); check("Phone: trip action docked at the bottom", dock.is_visible() and dock.bounding_box()["y"]+dock.bounding_box()["height"]<=845)
    box=P.locator(".ap-bought").first.bounding_box(); check("Phone: Bought checkbox is at least 32px", box["width"]>=32 and box["height"]>=32, str(box))
    P.screenshot(path=SP+"phone-roommate.png")
    P.screenshot(path=SP+"phone-roommate-full.png", full_page=True)
    A.set_viewport_size({"width":390,"height":844}); A.wait_for_timeout(500); A.evaluate("window.scrollTo(0, document.body.scrollHeight)")
    A.screenshot(path=SP+"phone-shopper.png")
    A.locator(".ap-dock button").click(); A.wait_for_timeout(400)
    check("Phone: dock opens the finish confirmation", A.locator(".ap-confirm").count()>0)
    # keyboard: tab order reaches Bought checkbox and Details
    b.close()
print("ERRORS:", errs)
print(f"{sum(r[1] for r in results)}/{len(results)} passed")
