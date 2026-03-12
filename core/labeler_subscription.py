"""
Labeler subscription management for reverie.house guardian system.

Configures ATProto labeler subscriptions so wards/charges automatically
receive content filtering based on their guardian's curation.

NOTE: Full implementation deferred. Configuring a user's labeler subscription
requires their OAuth session (access_jwt + pds_endpoint) to call
com.atproto.repo.putRecord on their behalf, which is complex.
Currently logs operations for manual follow-up.
"""

# Module-level singleton
_subscription_manager = None


def get_subscription_manager():
    """Get or create the singleton SubscriptionManager."""
    global _subscription_manager
    if _subscription_manager is None:
        _subscription_manager = SubscriptionManager()
    return _subscription_manager


class SubscriptionManager:
    """Manages labeler subscription configuration for guardian wards/charges."""

    LABELER_DID = 'did:plc:pfyyashnoatlhgwwfq7ut64l'

    def configure_ward_subscription(self, user_did, guardian_did, guardian_handle,
                                     pds_endpoint=None, access_jwt=None):
        """Configure ward labeler subscription.

        Wards receive full filtering — barred content is hidden.
        Would call putRecord on user's PDS to add lore.farm labeler to their preferences.
        """
        print(f"[LabelerSub] Ward subscription requested: {user_did} under guardian {guardian_handle}")
        print(f"[LabelerSub] ℹ️  User should subscribe to labeler {self.LABELER_DID} manually")
        return {
            'success': True,
            'message': 'Subscription noted. User should subscribe to lore.farm labeler for full filtering.',
            'labeler_did': self.LABELER_DID,
            'deferred': True
        }

    def configure_charge_subscription(self, user_did, guardian_did, guardian_handle,
                                       pds_endpoint=None, access_jwt=None):
        """Configure charge labeler subscription.

        Charges receive advisory filtering — barred content is flagged but not hidden.
        """
        print(f"[LabelerSub] Charge subscription requested: {user_did} under guardian {guardian_handle}")
        print(f"[LabelerSub] ℹ️  User should subscribe to labeler {self.LABELER_DID} manually")
        return {
            'success': True,
            'message': 'Subscription noted. User should subscribe to lore.farm labeler for advisory filtering.',
            'labeler_did': self.LABELER_DID,
            'deferred': True
        }

    def remove_subscription(self, user_did, pds_endpoint=None, access_jwt=None):
        """Remove labeler subscription when leaving a guardian."""
        print(f"[LabelerSub] Subscription removal requested for {user_did}")
        print(f"[LabelerSub] ℹ️  User can unsubscribe from labeler {self.LABELER_DID} manually")
        return {
            'success': True,
            'message': 'Subscription removal noted.',
            'labeler_did': self.LABELER_DID,
            'deferred': True
        }
