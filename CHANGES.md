# 2.0.0 (UNRELEASED)
- [NEW] Added API for upcoming IBM Cloud Identity and Access Management support
  for Cloudant on IBM Cloud. Note: IAM API key support is not yet enabled in the
  service.
- [NEW] Support multiple plugins. See 'api-migration.md' for migration details.
- [NEW] Allow custom service name in CloudFoundry VCAP_SERVICES environment
  variable.
- [FIXED] Fix `get_security`/`set_security` asymmetry.
- [IMPROVED] Updated documentation by replacing deprecated Cloudant links with
  the latest bluemix.net links.
- [REMOVED] Remove previously deprecated method `set_permissions`.

# 1.10.0 (2017-11-01)
- [UPGRADED] Upgrade package: cloudant-nano@6.7.0.

# 1.9.0 (2017-10-20)
- [NEW] Add 'error' & 'response' events to 429 retry plugin stream.
- [FIXED] `{silent: true}` to dotenv to prevent `.env` warnings.
- [UPGRADED] Upgrade package: cloudant-nano@6.6.0.
- [UPGRADED] Upgrade package: debug@^3.1.0.
- [UPGRADED] Upgrade package: request@^2.81.0.

# 1.8.0 (2017-05-23)
- [UPGRADED] Using cloudant-nano==6.5.0 dependancy.
