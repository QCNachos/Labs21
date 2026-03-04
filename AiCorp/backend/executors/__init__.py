"""
Step executors registry.
Each step kind maps to a function that takes (supabase_client, step_data) and returns output.
"""

from executors.analyze import execute_analyze
from executors.write_content import execute_write_content
from executors.draft_tweet import execute_draft_tweet
from executors.post_tweet import execute_post_tweet
from executors.crawl import execute_crawl
from executors.diagnose import execute_diagnose
from executors.review import execute_review
from executors.deploy import execute_deploy
from executors.generate_briefing import execute_generate_briefing
from executors.financial_analysis import execute_financial_analysis
from executors.scan_repos import execute_scan_repos
from executors.research_investors import execute_research_investors
from executors.update_deck import execute_update_deck
from executors.propose_hire import execute_propose_hire


# Registry: step_kind -> executor function
EXECUTOR_REGISTRY = {
    # Original executors
    "analyze": execute_analyze,
    "write_content": execute_write_content,
    "draft_tweet": execute_draft_tweet,
    "post_tweet": execute_post_tweet,
    "crawl": execute_crawl,
    "diagnose": execute_diagnose,
    "review": execute_review,
    "deploy": execute_deploy,
    # Corporate structure executors
    "generate_briefing": execute_generate_briefing,
    "financial_analysis": execute_financial_analysis,
    "scan_repos": execute_scan_repos,
    "research_investors": execute_research_investors,
    "update_deck": execute_update_deck,
    # Org management
    "propose_hire": execute_propose_hire,
}


def get_executor(step_kind: str):
    """Get the executor function for a step kind."""
    return EXECUTOR_REGISTRY.get(step_kind)
