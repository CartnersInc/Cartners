"""First-use membership isolation and the needed → purchased lifecycle."""
from secrets import token_hex
from uuid import uuid4
from fastapi.testclient import TestClient
from app.main import create_app
from app import suggestions


def create(client, name='Avery'):
    body = dict(name=name, householdName='Test table', kind='roommates', sessionToken=token_hex(32), inviteCode=token_hex(32), servings=4, restrictions=['vegetarian'])
    response = client.post('/api/households', json=body)
    assert response.status_code == 200, response.text
    return body, response.json()


def test_membership_isolation_join_and_retry(tmp_path):
    with TestClient(create_app(tmp_path / 'households.db')) as client:
        body, data = create(client)
        wid, actor = data['workspace']['workspaceId'], data['actorId']
        assert data['workspace']['items'] == []
        assert data['workspace']['plans'] == []
        assert data['workspace']['activity'] == []
        assert data['workspace']['preferences']['restrictions'] == ['vegetarian']
        assert data['workspace']['actors'] == [{'id': actor, 'name': 'Avery'}]
        assert [g['workspaceId'] for g in data['workspace']['groups']] == [wid]
        assert client.post('/api/households', json=body).json()['actorId'] == actor
        assert client.get('/api/workspace', params={'workspaceId':wid}).status_code == 401
        headers = {'Authorization':f"Bearer {body['sessionToken']}"}
        assert client.get('/api/workspace', params={'workspaceId':wid}, headers=headers).status_code == 200
        _, other = create(client, 'Robin')
        assert client.get('/api/workspace', params={'workspaceId':other['workspace']['workspaceId']}, headers=headers).status_code == 401
        demo = client.get('/api/workspace', params={'workspaceId':'demo-family'}).json()
        assert wid not in [g['workspaceId'] for g in demo['groups']]
        assert client.post('/api/households/join', json={'name':'Jamie','sessionToken':token_hex(32),'inviteCode':token_hex(32)}).status_code == 404
        join = {'name':'Jamie','sessionToken':token_hex(32),'inviteCode':body['inviteCode']}
        joined = client.post('/api/households/join', json=join).json()
        assert len(joined['workspace']['actors']) == 2
        assert client.post('/api/households/join', json=join).json()['actorId'] == joined['actorId']
        assert client.post('/api/items', json={'workspaceId':wid,'actorId':joined['actorId'],'requestId':str(uuid4()),'name':'Rice'}, headers=headers).status_code == 403
        assert client.post('/api/items', json={'workspaceId':wid,'actorId':actor,'requestId':str(uuid4()),'name':'Rice'}, headers=headers).status_code == 200


def test_add_purchase_undo_and_next_run(tmp_path):
    with TestClient(create_app(tmp_path / 'state.db')) as client:
        body, data = create(client)
        headers = {'Authorization':f"Bearer {body['sessionToken']}"}
        common = {'workspaceId':data['workspace']['workspaceId'],'actorId':data['actorId']}
        def write(method, path, **fields):
            result = client.request(method, path, headers=headers, json={**common,'requestId':str(uuid4()),**fields})
            assert result.status_code == 200, result.text
            return result.json()
        first = write('POST','/api/items',name='Rice')
        item = next(i for i in first['workspace']['items'] if i['id'] == first['itemId'])
        assert item['bought'] is False
        started = write('PATCH','/api/trip',expectedTripVersion=first['workspace']['trip']['version'],action='start',storeName='QFC')
        item = next(i for i in started['workspace']['items'] if i['id'] == item['id'])
        bought = write('PATCH',f"/api/items/{item['id']}",expectedItemVersion=item['version'],bought=True)
        result = write('POST',f"/api/actions/{first['actionId']}/undo")
        assert not next(i for i in result['workspace']['items'] if i['id'] == item['id'])['removed']
        done = write('PATCH','/api/trip',expectedTripVersion=bought['workspace']['trip']['version'],action='finish')
        again = write('PATCH','/api/trip',expectedTripVersion=done['workspace']['trip']['version'],action='start',storeName='QFC')
        old = next(i for i in again['workspace']['items'] if i['id'] == item['id'])
        assert old['runId'] != again['workspace']['trip']['id']
        second = write('POST','/api/items',name='Rice')
        assert second['itemId'] != item['id']


def test_private_household_idea_reaches_joined_members(tmp_path, monkeypatch):
    monkeypatch.setattr('app.main.build_suggestion', lambda **kwargs: suggestions._stamp(
        suggestions.sample_draft_for_message(kwargs['message']),
        workspace_id=kwargs['workspace_id'], plan_date=kwargs['plan_date'].isoformat(),
        list_revision=kwargs['list_revision'], previous=None,
    ))
    with TestClient(create_app(tmp_path / 'shared.db')) as client:
        owner, created = create(client)
        wid, actor = created['workspace']['workspaceId'], created['actorId']
        owner_headers = {'Authorization': f"Bearer {owner['sessionToken']}"}
        joining = {'name': 'Jamie', 'sessionToken': token_hex(32), 'inviteCode': owner['inviteCode']}
        joined = client.post('/api/households/join', json=joining)
        assert joined.status_code == 200, joined.text
        member_headers = {'Authorization': f"Bearer {joining['sessionToken']}"}
        idea = client.post('/api/suggestions', headers=owner_headers, json={
            'workspaceId': wid, 'actorId': actor, 'requestId': str(uuid4()),
            'message': 'Milk and eggs', 'planDate': '2026-10-18',
        })
        assert idea.status_code == 200, idea.text
        draft = idea.json()
        assert draft['kind'] == 'grocery_list'
        assert client.get(f"/api/suggestions/{draft['draftId']}", params={'workspaceId': wid}, headers=member_headers).status_code == 200
        saved = client.post('/api/drafts/confirm', headers=owner_headers, json={
            'workspaceId': wid, 'actorId': actor, 'requestId': str(uuid4()),
            'draftId': draft['draftId'], 'expectedListRevision': draft['listRevision'], 'target': 'cart',
        })
        assert saved.status_code == 200, saved.text
        seen = client.get('/api/workspace', params={'workspaceId': wid}, headers=member_headers)
        assert seen.status_code == 200
        assert [item['name'] for item in seen.json()['items'] if not item['removed']] == [item['name'] for item in saved.json()['workspace']['items'] if not item['removed']]
        assert seen.json()['items']
        common = {'workspaceId': wid, 'actorId': actor}
        started = client.patch('/api/trip', headers=owner_headers, json={
            **common, 'requestId': str(uuid4()),
            'expectedTripVersion': saved.json()['workspace']['trip']['version'],
            'action': 'start', 'storeName': 'QFC', 'requestWindowMinutes': 10,
        })
        assert started.status_code == 200, started.text
        guest_view = client.get('/api/workspace', params={'workspaceId': wid}, headers=member_headers).json()
        assert guest_view['trip']['claimedBy'] == actor
        assert guest_view['trip']['storeName'] == 'QFC'
        item = next(row for row in started.json()['workspace']['items'] if not row['removed'])
        bought = client.patch(f"/api/items/{item['id']}", headers=owner_headers, json={
            **common, 'requestId': str(uuid4()), 'expectedItemVersion': item['version'], 'bought': True,
        })
        assert bought.status_code == 200, bought.text
        finished = client.patch('/api/trip', headers=owner_headers, json={
            **common, 'requestId': str(uuid4()),
            'expectedTripVersion': bought.json()['workspace']['trip']['version'], 'action': 'finish',
        })
        assert finished.status_code == 200, finished.text
        receipt = client.post('/api/expenses', headers=owner_headers, json={
            **common, 'requestId': str(uuid4()), 'totalCents': 1299, 'payerId': actor,
            'mode': 'pooled', 'sharedMemberIds': [actor, joined.json()['actorId']],
            'personalAllocations': {}, 'status': 'confirmed',
        })
        assert receipt.status_code == 200, receipt.text
        review = client.get('/api/workspace', params={'workspaceId': wid}, headers=member_headers).json()
        assert review['expenses']
        assert review['expenses'][-1]['totalCents'] == 1299
        assert review['expenses'][-1]['status'] == 'confirmed'
