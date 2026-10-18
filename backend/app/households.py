"""Device memberships and invitation-only households; no passwords or email accounts."""
import re
from hashlib import sha256
from uuid import uuid4

from fastapi import Request
from pydantic import BaseModel, ConfigDict, Field

from app.db import dumps, transaction
from app.errors import ApiError
from app.schemas import WriteBase

DEMO_IDS = {"demo-family", "demo-roommates"}
PUBLIC_PATHS = {"/api/health", "/api/ai/health", "/api/ingredients", "/api/households", "/api/households/join"}


def digest(value):
    return sha256(value.encode()).hexdigest()


async def authorize_household(request: Request):
    if request.url.path in PUBLIC_PATHS or not request.url.path.startswith('/api/'):
        return
    data = request.query_params
    if request.method not in {'GET', 'HEAD', 'OPTIONS'}:
        if 'multipart/form-data' in request.headers.get('content-type', ''):
            data = await request.form()
        else:
            try:
                data = await request.json()
            except ValueError:
                return  # The endpoint returns the appropriate validation error.
    if not hasattr(data, 'get'):
        return
    workspace_id = data.get('workspaceId')
    if workspace_id in DEMO_IDS:
        return
    token = request.headers.get('authorization', '').removeprefix('Bearer ')
    session = request.app.state.db.execute('SELECT * FROM member_sessions WHERE token_hash = ?', (digest(token),)).fetchone()
    if not session or session['workspace_id'] != workspace_id:
        raise ApiError(401, 'HOUSEHOLD_ACCESS', 'This household needs your saved membership. Rejoin with its invitation code.')
    if data.get('actorId') and data.get('actorId') != session['actor_id']:
        raise ApiError(403, 'MEMBER_MISMATCH', 'Use your own profile to make this change.')


class Membership(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True, extra='forbid')
    name: str = Field(min_length=1, max_length=60)
    sessionToken: str = Field(pattern=r'^[a-f0-9]{64}$')
    inviteCode: str = Field(pattern=r'^[a-f0-9]{64}$')


class NewHousehold(Membership):
    householdName: str = Field(min_length=1, max_length=80)
    kind: str = Field(pattern=r'^(family|roommates|friends|other)$')
    servings: int = Field(default=2, ge=1, le=12)
    restrictions: list[str] = Field(default_factory=list, max_length=20)
    likes: list[str] = Field(default_factory=list, max_length=20)
    maxPrepMinutes: int = Field(default=30, ge=1, le=240)


PAY_PATTERNS = {
    'venmo': re.compile(r'^[A-Za-z0-9_-]{5,30}$'),
    'cashapp': re.compile(r'^[A-Za-z][A-Za-z0-9]{0,19}$'),
    'paypal': re.compile(r'^[A-Za-z0-9]{1,20}$'),
    'zelle': re.compile(r'^([^\s@]+@[^\s@]+\.[^\s@]+|\+?[0-9 ()-]{7,20})$'),
}


class PayLinksPatch(WriteBase):
    payLinks: dict[str, str] = Field(default_factory=dict)


def cleaned_pay_links(raw: dict[str, str]) -> dict[str, str]:
    unknown = set(raw) - set(PAY_PATTERNS)
    if unknown:
        raise ApiError(422, 'INVALID_PAY_LINK', 'Only Venmo, Cash App, PayPal, and Zelle handles are stored.')
    cleaned = {}
    for key, pattern in PAY_PATTERNS.items():
        value = str(raw.get(key) or '').strip().lstrip('@$')
        if not value:
            continue
        if not pattern.fullmatch(value):
            raise ApiError(422, 'INVALID_PAY_LINK', f'Check the {key} handle.')
        cleaned[key] = value
    return cleaned


def register_household_routes(app):
    def result(store, session):
        return {'workspace': store.snapshot(session['workspace_id']), 'actorId': session['actor_id']}

    def existing(store, body):
        return store.conn.execute('SELECT * FROM member_sessions WHERE token_hash = ?', (digest(body.sessionToken),)).fetchone()

    def add_member(store, body, workspace_id):
        actor_id = f'member-{uuid4()}'
        store.conn.execute('INSERT INTO actors(id, name) VALUES (?, ?)', (actor_id, body.name))
        store.conn.execute('INSERT INTO workspace_actors VALUES (?, ?)', (workspace_id, actor_id))
        store.conn.execute('INSERT INTO member_sessions VALUES (?, ?, ?)', (digest(body.sessionToken), workspace_id, actor_id))
        store.conn.execute('UPDATE workspaces SET list_revision = list_revision + 1 WHERE id = ?', (workspace_id,))
        return {'workspace_id': workspace_id, 'actor_id': actor_id}

    @app.post('/api/households')
    def create(body: NewHousehold, request: Request):
        store = request.app.state.store
        if any(not entry.strip() or len(entry) > 100 for entry in body.restrictions + body.likes):
            raise ApiError(422, 'INVALID_PREFERENCES', 'Keep each preference between 1 and 100 characters.')
        with transaction(store.conn):
            session = existing(store, body)
            if session:
                return result(store, session)
            if store.conn.execute('SELECT 1 FROM household_invites WHERE code_hash = ?', (digest(body.inviteCode),)).fetchone():
                raise ApiError(409, 'INVITE_EXISTS', 'Please restart setup to create a new invitation.')
            workspace_id = f'household-{uuid4()}'
            spending_mode = 'split' if body.kind in {'roommates', 'friends'} else 'pooled'
            store.conn.execute('''INSERT INTO workspaces(id,name,spending_mode,household_kind,servings,restrictions_json,likes_json,max_prep_minutes,list_revision)
                                  VALUES (?,?,?,?,?,?,?,?,0)''',
                               (workspace_id, body.householdName, spending_mode, body.kind, body.servings, dumps(body.restrictions), dumps(body.likes), body.maxPrepMinutes))
            store.conn.execute("INSERT INTO trips(id,workspace_id,version,state) VALUES (?,?,0,'idle')", (f'trip-{uuid4()}', workspace_id))
            store.conn.execute('INSERT INTO household_invites VALUES (?,?)', (workspace_id, digest(body.inviteCode)))
            session = add_member(store, body, workspace_id)
            return result(store, session)

    @app.post('/api/households/join')
    def join(body: Membership, request: Request):
        store = request.app.state.store
        with transaction(store.conn):
            session = existing(store, body)
            if session:
                return result(store, session)
            invite = store.conn.execute('SELECT workspace_id FROM household_invites WHERE code_hash = ?', (digest(body.inviteCode),)).fetchone()
            if not invite:
                raise ApiError(404, 'INVITE_NOT_FOUND', 'That invitation was not found. Check the code with your household.')
            session = add_member(store, body, invite['workspace_id'])
            return result(store, session)

    @app.patch('/api/members/pay-links')
    def save_pay_links(body: PayLinksPatch, request: Request):
        store = request.app.state.store
        store.require_workspace(body.workspaceId)
        store.require_actor(body.workspaceId, body.actorId)
        links = cleaned_pay_links(body.payLinks)
        with transaction(store.conn):
            store.conn.execute('UPDATE actors SET pay_links_json = ? WHERE id = ?', (dumps(links), body.actorId))
            store.conn.execute('UPDATE workspaces SET list_revision = list_revision + 1 WHERE id = ?', (body.workspaceId,))
        return {'workspace': store.snapshot(body.workspaceId), 'changeSummary': 'Saved your payment handles. Opening a link never marks a debt paid.'}
