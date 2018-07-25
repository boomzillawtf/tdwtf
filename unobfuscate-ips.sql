-- TO USE THIS SCRIPT:
-- docker run -d --rm -u postgres --net wtdwtf -v "`pwd`:/data/script:ro" postgres psql -h wtdwtf-nodebb-postgres -d nodebb -v secret=abc123 -f /data/script/unobfuscate-ips.sql
-- where "abc123" is replaced with your NodeBB instance's config.json secret.
--
-- The script can be run at the same time as NodeBB on any version of this Docker image after the upgrade to NodeBB 1.10.
--
-- It will take quite a while for the script to finish as it has to compute over four billion SHA1 hashes. Not forever, but quite a while.

CREATE TABLE IF NOT EXISTS "wtdwtf_real_ip" (
	"ip" INET NOT NULL UNIQUE,
	"hash" BYTEA NOT NULL PRIMARY KEY CHECK(OCTET_LENGTH("hash") = 20)
);

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TEMPORARY TABLE "secret" ( "s" TEXT );
INSERT INTO "secret" ("s") VALUES (:'secret');

CREATE TEMPORARY TABLE "recent_ips" (
	"zhash" BYTEA
);
INSERT INTO "recent_ips"
SELECT DECODE(z."value", 'hex') "zhash"
  FROM "legacy_object_live" o
 INNER JOIN "legacy_zset" z
    ON o."_key" = z."_key"
   AND o."type" = z."type"
 WHERE z."_key" = 'ip:recent'
   AND z."value" SIMILAR TO '[0-9a-f]{40}';

DO $$
DECLARE
	secret TEXT;
	inc BIGINT;
	addr INET;
	hash BYTEA;
BEGIN

SELECT "s" INTO secret FROM "secret";

LOOP

	addr := inet '0.0.0.0' + inc;
	hash := DIGEST(CONVERT_TO(HOST(addr) || secret, 'SQL_ASCII'), 'sha1');

	IF EXISTS(SELECT 1 FROM "recent_ips" WHERE "zhash" = hash) THEN
		INSERT INTO "wtdwtf_real_ip" ("ip", "hash") VALUES (addr, hash) ON CONFLICT DO NOTHING;
	END IF;

	inc := inc + 1;
	EXIT WHEN inc = 2^32;

END LOOP;

END;
$$ LANGUAGE plpgsql;

CLUSTER VERBOSE "wtdwtf_real_ip" USING "wtdwtf_real_ip_pkey";
