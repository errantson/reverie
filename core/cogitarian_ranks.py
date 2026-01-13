"""
Cogitarian Ranking System

Each Cogitarian in succession is assigned a designation from this list.
When a challenge succeeds, the challenger becomes the next rank.
"""

# Ordered list of designations for Cogitarians
COGITARIAN_RANKS = [
    'Prime',    # The first/original
    'Alpha',
    'Beta',
    'Gamma',
    'Delta',
    'Epsilon',
    'Zeta',
    'Theta',
    'Iota',
    'Kappa',
    'Lambda',
    'Mu',
    'Nu',
    'Xi',
    'Omicron',
    'Pi',
    'Rho',
    'Sigma',
    'Tau',
    'Upsilon',
    'Phi',
    'Chi',
    'Psi',
    'Omega',    # The final
]


def get_rank_index(rank_name: str) -> int:
    """Get the index of a rank in the succession order."""
    try:
        return COGITARIAN_RANKS.index(rank_name)
    except ValueError:
        return -1


def get_next_rank(current_rank: str) -> str:
    """Get the next rank after the current one."""
    idx = get_rank_index(current_rank)
    if idx < 0 or idx >= len(COGITARIAN_RANKS) - 1:
        return None  # Omega is final
    return COGITARIAN_RANKS[idx + 1]


def get_current_cogitarian_rank(db_manager) -> tuple:
    """
    Determine the current cogitarian's rank based on history.
    Returns (rank_name, rank_index, cogitarian_count)
    """
    # Count total successful cogitarian tenures from events
    result = db_manager.fetch_one("""
        SELECT COUNT(DISTINCT did) as cogitarian_count
        FROM user_roles
        WHERE role = 'cogitarian'
    """)
    
    count = result['cogitarian_count'] if result else 0
    
    # The current cogitarian's rank is based on how many have come before
    # First cogitarian = Prime (index 0)
    rank_index = min(count - 1, len(COGITARIAN_RANKS) - 1) if count > 0 else 0
    rank_name = COGITARIAN_RANKS[rank_index] if count > 0 else COGITARIAN_RANKS[0]
    
    return (rank_name, rank_index, count)


def get_challenger_rank() -> str:
    """Get the rank a successful challenger would receive."""
    # For now, challengers always become Alpha (the first challenger designation)
    # until we implement multi-challenge tracking
    return 'Alpha'


def format_rank_display(rank_name: str) -> str:
    """Format rank for display."""
    return f"({rank_name})"
