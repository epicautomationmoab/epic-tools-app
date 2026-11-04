"""Read-only acceptance checks against the isolated UUI database.
Credentials stay in the caller-provided JSON file and are never logged.
"""
import concurrent.futures
import json
import sys
import urllib.error
import urllib.request

BASE = 'https://jgpihdpcdlqugmqanzfj.supabase.co'
KEY = 'sb_publishable_7egwBSRhnXWcyfs7nFrlgg_yo9W1KBv'
READERS = {
    'get_epic_routed_inbox_v2': {'p_include_cleaned': False},
    'get_epic_sales_blocked_domains': {},
    'get_epic_phone_report': {'p_local_date': None},
    'get_epic_inbox_collaborators': {},
    'get_epic_inbox_mentions': {},
    'get_c360_podium_inbox': {},
    'get_c360_telnyx_inbox': {},
    'get_c360_social_inbox': {},
    'get_c360_meta_inbox': {},
    'get_c360_instagram_inbox': {},
    'epic_catchup_attributed': {},
    'epic_ping_inbox': {},
    'get_epic_known_customer_matches': {'p_emails': [], 'p_phones': []},
    'c360_employee_search_phone_links': {'p_phones': []},
}

def request(path, body, token=None):
    headers = {'apikey': KEY, 'Content-Type': 'application/json'}
    if token:
        headers['Authorization'] = 'Bearer ' + token
    req = urllib.request.Request(BASE + path, data=json.dumps(body).encode(), headers=headers)
    try:
        with urllib.request.urlopen(req, timeout=30) as response:
            return response.status, json.load(response)
    except urllib.error.HTTPError as error:
        return error.code, json.load(error)

def main():
    accounts = json.load(open(sys.argv[1]))
    sessions = {'anonymous': None}
    for label, email in [('employee', 'jennifer@uui-test.example'), ('workstation', 'workstation@uui-test.example')]:
        account = next(a for a in accounts if a['email'] == email)
        status, response = request('/auth/v1/token?grant_type=password', {'email': email, 'password': account['password']})
        if status != 200:
            raise RuntimeError(label + ' test sign-in failed')
        sessions[label] = response['access_token']

    def check(item):
        label, name = item
        status, payload = request('/rest/v1/rpc/' + name, READERS[name], sessions[label])
        # SQL reader functions may deliberately return no rows for unauthorized roles.
        explicit_denial = isinstance(payload, dict) and payload.get('code') == 'P0001' and payload.get('message') in ('Active Epic employee profile required', 'Active employee profile required', 'Active employee required', 'Employee login required')
        passed = status == 200 if label == 'employee' else status in (401, 403) or (label == 'workstation' and ((status == 200 and payload == []) or (status == 400 and explicit_denial)))
        return {'role': label, 'function': name, 'status': status, 'passed': passed}

    with concurrent.futures.ThreadPoolExecutor(max_workers=6) as pool:
        results = list(pool.map(check, [(role, name) for role in sessions for name in READERS]))
    print(json.dumps({'passed': sum(r['passed'] for r in results), 'total': len(results), 'checks': results}, indent=2))
    return 0 if all(r['passed'] for r in results) else 1

if __name__ == '__main__':
    sys.exit(main())
