-- Apply explicitly through the private application role, never the public schema.
CREATE TABLE IF NOT EXISTS hub_rustsession (
    session_hash text PRIMARY KEY CHECK (length(session_hash) = 43),
    user_id uuid REFERENCES hub_user(id) ON DELETE CASCADE,
    csrf_token text NOT NULL CHECK (length(csrf_token) = 43),
    expires_at timestamptz NOT NULL,
    oauth_verifier text,
    oauth_state_hash text,
    oauth_started_at timestamptz,
    CHECK ((oauth_verifier IS NULL) = (oauth_state_hash IS NULL)),
    CHECK ((oauth_verifier IS NULL) = (oauth_started_at IS NULL))
);
CREATE INDEX IF NOT EXISTS hub_rustsession_expiry ON hub_rustsession(expires_at);
CREATE INDEX IF NOT EXISTS hub_rustsession_user ON hub_rustsession(user_id);
CREATE TABLE IF NOT EXISTS hub_chatlease (
    user_id uuid PRIMARY KEY REFERENCES hub_user(id) ON DELETE CASCADE,
    owner uuid NOT NULL,
    expires_at timestamptz NOT NULL
);
REVOKE ALL ON hub_rustsession FROM PUBLIC;
REVOKE ALL ON hub_chatlease FROM PUBLIC;
DO $$
DECLARE role_name text;
BEGIN
    FOR role_name IN SELECT rolname FROM pg_roles WHERE rolname IN ('anon', 'authenticated') LOOP
        EXECUTE format('REVOKE ALL ON hub_rustsession FROM %I', role_name);
        EXECUTE format('REVOKE ALL ON hub_chatlease FROM %I', role_name);
    END LOOP;
END $$;
