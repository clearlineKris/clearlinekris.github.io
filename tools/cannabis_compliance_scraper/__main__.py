"""Allow `python -m cannabis_compliance_scraper` invocation."""

from .cli import main
import sys

if __name__ == "__main__":
    sys.exit(main())
