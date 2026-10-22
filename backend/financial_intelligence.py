
from decimal import Decimal


def analyze_spending(transactions: list[dict]) -> dict:
    """
    Analyze a user's transactions and return basic financial metrics.

    Each transaction must contain:
    amount, transaction_type, and category.
    """

    total_income = Decimal("0.00")
    total_expenses = Decimal("0.00")
    spending_by_category = {}

    for transaction in transactions:
        amount = Decimal(str(transaction["amount"]))
        transaction_type = transaction["transaction_type"]
        category = transaction["category"]

        if amount < 0:
            raise ValueError("Transaction amounts must be non-negative.")

        if transaction_type == "income":
            total_income += amount

        elif transaction_type == "expense":
            total_expenses += amount
            spending_by_category[category] = (
                spending_by_category.get(category, Decimal("0.00"))
                + amount
            )

        else:
            raise ValueError(
                "transaction_type must be 'income' or 'expense'."
            )

    balance = total_income - total_expenses

    if total_income > 0:
        savings_rate = (balance / total_income) * Decimal("100")
    else:
        savings_rate = None

    highest_spending_category = None

    if spending_by_category:
        highest_spending_category = max(
            spending_by_category,
            key=spending_by_category.get,
        )

    return {
        "total_income": str(total_income),
        "total_expenses": str(total_expenses),
        "remaining_balance": str(balance),
        "savings_rate_percent": (
            str(savings_rate.quantize(Decimal("0.01")))
            if savings_rate is not None
            else None
        ),
        "spending_by_category": {
            category: str(amount)
            for category, amount in sorted(
                spending_by_category.items(),
                key=lambda item: item[1],
                reverse=True,
            )
        },
        "highest_spending_category": highest_spending_category,
        "transaction_count": len(transactions),
    }


from sqlalchemy.orm import Session

from models import Transaction


def analyze_user_spending(db: Session, user_id: int) -> dict:
    """
    Analyze transactions belonging to one user only.
    """

    transactions = (
        db.query(Transaction)
        .filter(Transaction.user_id == user_id)
        .all()
    )

    transaction_data = [
        {
            "amount": transaction.amount,
            "transaction_type": transaction.transaction_type,
            "category": transaction.category,
        }
        for transaction in transactions
    ]

    return analyze_spending(transaction_data)


from collections import defaultdict


def calculate_monthly_spending(transactions: list[dict]) -> list[dict]:
    """
    Calculate total expenses for each calendar month.

    Each transaction must contain:
    transaction_date, amount, and transaction_type.
    """

    monthly_totals = defaultdict(lambda: Decimal("0.00"))

    for transaction in transactions:
        if transaction["transaction_type"] != "expense":
            continue

        transaction_date = transaction["transaction_date"]
        month_key = transaction_date.strftime("%Y-%m")
        amount = Decimal(str(transaction["amount"]))

        if amount < 0:
            raise ValueError("Transaction amounts must be non-negative.")

        monthly_totals[month_key] += amount

    return [
        {
            "month": month,
            "total_expenses": str(total.quantize(Decimal("0.01"))),
        }
        for month, total in sorted(monthly_totals.items())
    ]


def get_user_monthly_spending(db: Session, user_id: int) -> list[dict]:
    """
    Fetch a user's transactions and calculate monthly expenses.
    """

    transactions = (
        db.query(Transaction)
        .filter(Transaction.user_id == user_id)
        .order_by(Transaction.transaction_date.asc())
        .all()
    )

    transaction_data = [
        {
            "transaction_date": transaction.transaction_date,
            "amount": transaction.amount,
            "transaction_type": transaction.transaction_type,
        }
        for transaction in transactions
    ]

    return calculate_monthly_spending(transaction_data)



def get_user_category_monthly_spending(
    db: Session,
    user_id: int,
) -> list[dict]:
    """
    Calculate each user's expense totals by category and calendar month.
    Only the specified user's transactions are included.
    """

    transactions = (
        db.query(Transaction)
        .filter(Transaction.user_id == user_id)
        .filter(Transaction.transaction_type == "expense")
        .order_by(Transaction.transaction_date.asc())
        .all()
    )

    monthly_categories = {}

    for transaction in transactions:
        month = transaction.transaction_date.strftime("%Y-%m")
        category = transaction.category
        amount = Decimal(str(transaction.amount))

        if amount < 0:
            raise ValueError("Transaction amounts must be non-negative.")

        if month not in monthly_categories:
            monthly_categories[month] = {}

        monthly_categories[month][category] = (
            monthly_categories[month].get(category, Decimal("0.00"))
            + amount
        )

    return [
        {
            "month": month,
            "spending_by_category": {
                category: str(amount.quantize(Decimal("0.01")))
                for category, amount in sorted(
                    categories.items()
                )
            },
        }
        for month, categories in sorted(monthly_categories.items())
    ]



def compare_category_monthly_spending(
    monthly_category_spending: list[dict],
) -> list[dict]:
    """
    Compare category expenses with the previous calendar month.
    """

    from datetime import datetime

    spending_by_month = {
        item["month"]: {
            category: Decimal(str(amount))
            for category, amount in item["spending_by_category"].items()
        }
        for item in monthly_category_spending
    }

    results = []

    for item in monthly_category_spending:
        month = item["month"]
        month_date = datetime.strptime(month, "%Y-%m")

        if month_date.month == 1:
            previous_month = f"{month_date.year - 1}-12"
        else:
            previous_month = (
                f"{month_date.year}-{month_date.month - 1:02d}"
            )

        current_spending = spending_by_month[month]
        previous_spending = spending_by_month.get(previous_month, {})

        for category, current_amount in current_spending.items():
            previous_amount = previous_spending.get(category)

            if previous_amount is None:
                change_amount = None
                change_percent = None
                trend = "no_previous_data"
            else:
                change = current_amount - previous_amount
                change_amount = str(change.quantize(Decimal("0.01")))

                if previous_amount == 0:
                    change_percent = None
                    trend = "increased" if change > 0 else "unchanged"
                else:
                    percentage = change / previous_amount * Decimal("100")
                    change_percent = str(
                        percentage.quantize(Decimal("0.01"))
                    )

                    if change > 0:
                        trend = "increased"
                    elif change < 0:
                        trend = "decreased"
                    else:
                        trend = "unchanged"

            results.append({
                "month": month,
                "category": category,
                "current_amount": str(
                    current_amount.quantize(Decimal("0.01"))
                ),
                "previous_month": previous_month,
                "previous_amount": (
                    str(previous_amount.quantize(Decimal("0.01")))
                    if previous_amount is not None
                    else None
                ),
                "change_amount": change_amount,
                "change_percent": change_percent,
                "trend": trend,
            })

    return results


from datetime import datetime
from decimal import Decimal


def compare_monthly_spending(monthly_spending: list[dict]) -> list[dict]:
    """
    Compare each month's expenses with the previous calendar month.
    """

    expenses_by_month = {
        item["month"]: Decimal(str(item["total_expenses"]))
        for item in monthly_spending
    }

    results = []

    for item in monthly_spending:
        current_month = item["month"]
        current_expenses = expenses_by_month[current_month]

        month_date = datetime.strptime(current_month, "%Y-%m")
        if month_date.month == 1:
            previous_month = f"{month_date.year - 1}-12"
        else:
            previous_month = (
                f"{month_date.year}-{month_date.month - 1:02d}"
            )

        previous_expenses = expenses_by_month.get(previous_month)

        if previous_expenses is None:
            change_amount = None
            change_percent = None
            trend = "no_previous_month_data"
        else:
            change = current_expenses - previous_expenses
            change_amount = str(change.quantize(Decimal("0.01")))

            if previous_expenses == 0:
                change_percent = None
                trend = "increased" if change > 0 else "unchanged"
            else:
                percentage = (change / previous_expenses) * Decimal("100")
                change_percent = str(
                    percentage.quantize(Decimal("0.01"))
                )

                if change > 0:
                    trend = "increased"
                elif change < 0:
                    trend = "decreased"
                else:
                    trend = "unchanged"

        results.append({
            "month": current_month,
            "total_expenses": str(
                current_expenses.quantize(Decimal("0.01"))
            ),
            "previous_month": previous_month,
            "previous_month_expenses": (
                str(previous_expenses.quantize(Decimal("0.01")))
                if previous_expenses is not None
                else None
            ),
            "change_amount": change_amount,
            "change_percent": change_percent,
            "trend": trend,
        })

    return results



def generate_spending_alerts(analysis: dict) -> list[dict]:
    """
    Generate simple financial alerts from a user's spending analysis.
    """
    alerts = []

    income = Decimal(str(analysis["total_income"]))
    expenses = Decimal(str(analysis["total_expenses"]))
    balance = Decimal(str(analysis["remaining_balance"]))
    category_spending = analysis["spending_by_category"]

    if income == 0 and expenses > 0:
        alerts.append({
            "type": "missing_income",
            "severity": "warning",
            "message": (
                "You have recorded expenses but no income. "
                "Add your income records for a more useful analysis."
            ),
        })

    elif income > 0:
        expense_ratio = (expenses / income) * Decimal("100")

        if expense_ratio > 100:
            alerts.append({
                "type": "expenses_exceed_income",
                "severity": "high",
                "message": (
                    "Your recorded expenses exceed your recorded income. "
                    "Review your spending and check whether all records "
                    "are accurate."
                ),
            })
        elif expense_ratio >= 80:
            alerts.append({
                "type": "high_expense_ratio",
                "severity": "warning",
                "message": (
                    "Your expenses use at least 80% of your recorded "
                    "income. Review your spending and savings goals."
                ),
            })

    if balance < 0:
        alerts.append({
            "type": "negative_balance",
            "severity": "high",
            "message": (
                "Your recorded expenses are higher than your recorded "
                "income for the analyzed transactions."
            ),
        })

    if category_spending:
        highest_category = next(iter(category_spending))
        highest_amount = Decimal(str(category_spending[highest_category]))

        alerts.append({
            "type": "top_spending_category",
            "severity": "info",
            "category": highest_category,
            "amount": str(highest_amount),
            "message": (
                f"Your highest-spending category is {highest_category}."
            ),
        })

    if not alerts:
        alerts.append({
            "type": "no_major_alert",
            "severity": "info",
            "message": (
                "No spending alerts were triggered by the current rules. "
                "Keep reviewing your budget regularly."
            ),
        })

    return alerts



def generate_financial_recommendations(analysis: dict) -> list[dict]:
    """
    Generate explainable financial recommendations from spending data.
    These are rule-based recommendations, not ML predictions.
    """
    recommendations = []

    income = Decimal(str(analysis["total_income"]))
    expenses = Decimal(str(analysis["total_expenses"]))
    balance = Decimal(str(analysis["remaining_balance"]))
    category_spending = analysis["spending_by_category"]

    if income <= 0:
        recommendations.append({
            "type": "record_income",
            "priority": "high",
            "title": "Record your income",
            "message": (
                "Add your income records to calculate your savings rate "
                "and make your financial analysis more useful."
            ),
        })
        return recommendations

    if balance < 0:
        recommendations.append({
            "type": "reduce_expenses",
            "priority": "high",
            "title": "Review your expenses",
            "message": (
                "Your recorded expenses exceed your income. Review your "
                "transactions and identify expenses you can reduce."
            ),
        })

    elif balance == 0:
        recommendations.append({
            "type": "start_saving",
            "priority": "high",
            "title": "Start building savings",
            "message": (
                "Your recorded income is fully used by expenses. "
                "Look for a manageable expense to reduce and begin saving."
            ),
        })

    else:
        savings_rate = (balance / income) * Decimal("100")
        target_savings = (income * Decimal("0.20")).quantize(Decimal("0.01"))

        if savings_rate < 20:
            recommendations.append({
                "type": "improve_savings",
                "priority": "medium",
                "target_savings_amount": str(target_savings),
                "title": "Improve your savings rate",
                "message": (
                    f"Your current savings rate is "
                    f"{savings_rate.quantize(Decimal('0.01'))}%. "
                    "Review non-essential expenses and set a realistic "
                    "monthly savings target."
                ),
            })
        else:
            recommendations.append({
                "type": "maintain_savings",
                "priority": "low",
                "title": "Keep building your savings",
                "message": (
                    f"Your recorded savings rate is "
                    f"{savings_rate.quantize(Decimal('0.01'))}%. "
                    "Continue tracking expenses and working toward "
                    "your savings goals."
                ),
            })

    if category_spending:
        highest_category = max(
            category_spending,
            key=lambda category: Decimal(str(category_spending[category])),
        )
        highest_amount = Decimal(str(category_spending[highest_category]))

        recommendations.append({
            "type": "review_top_category",
            "priority": "medium",
            "title": f"Review spending on {highest_category}",
            "message": (
                f"{highest_category} is your highest-spending category, "
                f"with recorded expenses of {highest_amount:.2f}. "
                "Check whether this spending matches your priorities "
                "before deciding to reduce it."
            ),
        })

    return recommendations



def generate_spending_trend_recommendations(
    category_comparisons: list[dict],
) -> list[dict]:
    """
    Generate recommendations from month-to-month category spending changes.
    """

    recommendations = []

    for item in category_comparisons:
        if item["trend"] != "increased":
            continue

        change_percent = item["change_percent"]

        # A percentage cannot be calculated when previous spending was zero.
        if change_percent is None:
            continue

        percentage = Decimal(str(change_percent))

        # Recommend a review only when spending increased by at least 25%.
        if percentage >= 25:
            category = item["category"]
            increase = Decimal(str(item["change_amount"]))

            recommendations.append({
                "type": "category_spending_increase",
                "priority": "medium",
                "title": f"Review your {category} spending",
                "message": (
                    f"Your spending on {category} increased by "
                    f"{percentage:.2f}% compared with the previous "
                    f"month, a rise of {increase:.2f}. "
                    "Review the transactions to decide whether "
                    "this increase was necessary."
                ),
                "category": category,
                "change_percent": str(percentage.quantize(Decimal("0.01"))),
                "change_amount": str(increase.quantize(Decimal("0.01"))),
                "month": item["month"],
            })

    return recommendations



def generate_budget_recommendations(
    budgets: list[dict],
    spending_by_category: dict,
) -> list[dict]:
    """
    Generate recommendations by comparing monthly category budgets
    with actual spending.

    Each budget must contain:
    category, budget_amount.

    spending_by_category maps category names to expense amounts.
    """

    recommendations = []

    for budget in budgets:
        category = budget["category"]
        budget_amount = Decimal(str(budget["budget_amount"]))
        spent = Decimal(
            str(spending_by_category.get(category, "0.00"))
        )

        if budget_amount <= 0:
            raise ValueError("Budget amounts must be greater than zero.")

        usage_percent = (spent / budget_amount) * Decimal("100")
        usage_percent = usage_percent.quantize(Decimal("0.01"))

        if spent > budget_amount:
            recommendations.append({
                "type": "budget_exceeded",
                "priority": "high",
                "category": category,
                "budget_amount": str(budget_amount.quantize(Decimal("0.01"))),
                "spent_amount": str(spent.quantize(Decimal("0.01"))),
                "usage_percent": str(usage_percent),
                "title": f"{category} budget exceeded",
                "message": (
                    f"You spent {spent:.2f} on {category}, exceeding "
                    f"your budget of {budget_amount:.2f}. "
                    "Review your remaining expenses in this category."
                ),
            })

        elif usage_percent >= 80:
            recommendations.append({
                "type": "budget_near_limit",
                "priority": "medium",
                "category": category,
                "budget_amount": str(budget_amount.quantize(Decimal("0.01"))),
                "spent_amount": str(spent.quantize(Decimal("0.01"))),
                "usage_percent": str(usage_percent),
                "title": f"You're approaching your {category} budget",
                "message": (
                    f"You have used {usage_percent}% of your "
                    f"{category} budget. Review upcoming expenses "
                    "to stay within your limit."
                ),
            })

    return recommendations



from datetime import date
from calendar import monthrange
from decimal import Decimal

def get_monthly_spending_by_category(
    db: Session,
    user_id: int,
    month_start: date,
) -> dict:
    next_month_year = month_start.year
    next_month_number = month_start.month + 1

    if next_month_number == 13:
        next_month_year += 1
        next_month_number = 1

    next_month_start = date(next_month_year, next_month_number, 1)

    transactions = (
        db.query(Transaction)
        .filter(Transaction.user_id == user_id)
        .filter(Transaction.transaction_type == "expense")
        .filter(Transaction.transaction_date >= month_start)
        .filter(Transaction.transaction_date < next_month_start)
        .all()
    )

    spending_by_category = {}

    for transaction in transactions:
        amount = Decimal(str(transaction.amount))
        category = transaction.category

        spending_by_category[category] = (
            spending_by_category.get(category, Decimal("0.00"))
            + amount
        )

    return {
        category: str(amount.quantize(Decimal("0.01")))
        for category, amount in spending_by_category.items()
    }
