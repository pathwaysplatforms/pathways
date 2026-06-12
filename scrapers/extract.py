"""
Standalone CLI for the immigration pathway extraction pipeline.

Usage:
  python extract.py                      # extract all Canadian pathways
  python extract.py --visa-type pgwp     # extract a single pathway
  python extract.py --force              # re-extract even if updated recently
  python extract.py --dry-run            # print what would be extracted (no API calls)
  python extract.py --country canada     # explicit country (default: canada)
"""

import argparse
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))

from extractor import run_extraction
from utils.logger import get_logger

logger = get_logger(__name__)


def main() -> None:
    """Entry point for the extraction CLI."""
    parser = argparse.ArgumentParser(
        description="Extract structured pathway metadata from immigration_chunks into pathways table."
    )
    parser.add_argument(
        "--visa-type",
        type=str,
        default=None,
        metavar="VISA_TYPE",
        help="Extract a single visa_type (e.g. pgwp, express_entry_fsw). Default: all.",
    )
    parser.add_argument(
        "--country",
        type=str,
        default="canada",
        help="Country to extract pathways for (default: canada).",
    )
    parser.add_argument(
        "--force",
        action="store_true",
        help="Re-extract even if pathway was updated within the last 7 days.",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Print what would be extracted without calling Claude or writing to DB.",
    )
    args = parser.parse_args()

    visa_types = [args.visa_type] if args.visa_type else None

    logger.info(
        f"Starting extraction: country={args.country}, "
        f"visa_types={visa_types or 'all'}, "
        f"force={args.force}, dry_run={args.dry_run}"
    )

    try:
        summary = run_extraction(
            country=args.country,
            visa_types=visa_types,
            force=args.force,
            dry_run=args.dry_run,
        )
    except (EnvironmentError, RuntimeError, ValueError) as exc:
        logger.error(f"Extraction aborted: {exc}")
        sys.exit(1)

    print("\n" + "=" * 60)
    print("Extraction Summary")
    print("=" * 60)
    print(f"  Processed : {summary['processed']}")
    print(f"  Skipped   : {summary['skipped']}")
    print(f"  Failed    : {summary['failed']}")
    if summary["errors"]:
        print("\n  Errors:")
        for err in summary["errors"]:
            print(f"    [{err['visa_type']}] {err['error'][:120]}")
    print("=" * 60 + "\n")

    if summary["failed"] > 0:
        sys.exit(1)


if __name__ == "__main__":
    main()
