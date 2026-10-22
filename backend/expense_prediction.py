
from sqlalchemy.orm import Session
from models import Transaction
from ml.train_model import predict_next_month_from_data


def predict_next_month_expense(monthly_expenses):
    """
    Predict next month's expense using the trained
    Linear Regression prediction function.
    """
    return predict_next_month_from_data(monthly_expenses)



def get_monthly_expenses(db: Session, user_id: int):
    """Return the user's monthly expense totals, oldest month first."""

    transactions = (
        db.query(Transaction)
        .filter(Transaction.user_id == user_id)
        .filter(Transaction.transaction_type == "expense")
        .order_by(Transaction.transaction_date.asc())
        .all()
    )

    
    monthly_totals = {}

    for transaction in transactions:
        month = transaction.transaction_date.replace(day=1)
        monthly_totals[month] = (
            monthly_totals.get(month, 0.0)
            + float(transaction.amount)
        )

    if not monthly_totals:
        return []

    first_month = min(monthly_totals)
    last_month = max(monthly_totals)

    result = []
    current_month = first_month

    while current_month <= last_month:
        result.append({
            "month": current_month.isoformat(),
            "total_expense": round(
                monthly_totals.get(current_month, 0.0), 2
            ),
        })

        if current_month.month == 12:
            current_month = current_month.replace(
                year=current_month.year + 1,
                month=1,
            )
        else:
            current_month = current_month.replace(
                month=current_month.month + 1,
            )

    return result
