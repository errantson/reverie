# Privacy & Data Practices

**Last Updated:** December 5, 2025

**Everything on ATProto is public.** Your posts, profile updates, and interactions flow through a firehose that anyone can read. Across our wild mindscape, countless services scoop from this stream. Bluesky's AppView, feed generators, archival projects, analytics tools, and Reverie House.

You own your identity (DID), and you have a right to self-sovereign declarations. This means that you are free to compartmentalize parts of yourself into as many alternate accounts, personas, and handles as you wish. The account creation hub of Reverie House is meant to be as anonymizing as our setup can provide, to allow the independent self-declaration of who you are on your own terms. Our privacy front will know the origins of every identity, but our reciprocities in trust and server stewardship go hand in hand with the free mutualism of the protocol.

---

## What We Track

We monitor the public firehose for **Reverie House community members** (`.reverie.house` handles or quest participants).

**From the firehose:**
- Profile info (name, bio, avatar, handle)
- Public posts and replies
- Post labels from lore.farm
- Follower/following/post counts
- Handle changes

**Why:** Fast local queries for feeds, quests, and community lists. Querying the distributed network every time would be painfully slow.

**From you directly (optional):**
- Email (if you create a `.reverie.house` PDS account)
- App password (encrypted, if you claim a worker role)
- Login timestamps (for rate limiting)

---

## What We CANNOT Track

Because the network is still growing, and the nature of surveillance climates, we believe it is valuable to the culture of AT Protocol for users to operate under the assumption that they are under a panopticon of infernal scrutiny. Our experiments will intentionally push the boundaries of what is possible within the safety parameters laid out by the protocol and those who wrote it.

Stay skeptical of your privacy.
Assume only that which cannot be tracked (yet):

- ❌ Private/unlisted posts
- ❌ Direct messages (encrypted)
- ❌ Deleted posts (though assume tombstones persist)
- ❌ Email address (unless you give us a PDS account)
- ❌ Some activity in other apps (Bluesky, etc.)

---

## How We Use It

**Feeds:** Index posts for "Expanded Lore" (labeled posts) and "Idle Dreaming" (all community posts)

**Quests:** Monitor replies to quest URIs, check conditions, grant rewards

**Community Lists:** Sort members by activity, display avatars/bios

**Security:** Rate limiting, credential validation, audit logging

---

## Your Rights

**Self-Sovereign Identity:** Your DID is yours forever. Move PDS anytime*, use multiple personas.

**Data Deletion:**
1. Change handle away from `.reverie.house`
2. Email books@reverie.house with your DID
3. We purge within 7 days
4. *(Complain to mappy@reverie.house this isn't automated yet)

---

## Security

Worker passwords are encrypted (Fernet AES-128) before storage. Keys live in `/srv/secrets/` with restricted permissions. We validate credentials every 3 minutes and auto-disable invalid ones.

Why reversible encryption? We need the plaintext to authenticate with your PDS when posting on your behalf through the self-appointed optional worker system.

Database uses Docker secrets. Sessions are token-based with rate limiting and expiry. Everything's audit logged ad nauseum and we have sub-hourly backups for all Postgres and PDS account data.

---

## Third Parties

**lore.farm:** We read their public labels and users apply labels

**ATProto Network:** We connect to the public firehose (`wss://bsky.network`), your PDS, and auth endpoints as needed.

**Stripe:** Handles payments if you order books. We don't store card numbers, but do keep transaction data and reveal your canonical support if you choose to reveal it.

---

## Philosophy

ATProto chose radical transparency: public firehose, self-sovereign identity, federated data. We embrace this, and have built the foundations of Reverie House atop this concept. Freedom and responsibility hand-in-hand.

**Our stance:** Reverie House offers one level and option for your PDS contents and novel interactions at varying levels of risk. Just as you may choose to find another provider (witchcraft.systems, blacksky.social, selfhosted.socal), or rely on Bluesky's central network, you may choose to trust us and build a mutual service atop it for the sake of community.

You're welcome to stay here forever.
Or, at least until everything's destroyed.

---

## Questions?

- **Technical:** GitHub issues
- **Privacy/deletion/security:** books@reverie.house

**Version:** 2025-12-05 initial publish
