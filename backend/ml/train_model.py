
from pathlib import Path
import math

import pandas as pd
from sklearn.linear_model import LinearRegression


DATA_FILE = Path(__file__).parent / "sample_expenses.csv"


def load_expense_data():
    data = pd.read_csv(DATA_FILE)
    data["month"] = pd.to_datetime(data["month"])
    data = data.sort_values("month").reset_index(drop=True)

    if data["month"].duplicated().any():
        raise ValueError("Each month must appear only once.")

    if data["total_expense"].isna().any():
        raise ValueError("Expense data contains missing values.")

    if (data["total_expense"] < 0).any():
        raise ValueError("Expenses cannot be negative.")

    return data


def train_model():
    data = load_expense_data()

    if len(data) < 6:
        raise ValueError("At least 6 months of data is required.")

    data["month_number"] = range(len(data))

    # Reserve the final 4 months for evaluation.
    train_data = data.iloc[:-4]

    model = LinearRegression()
    model.fit(
        train_data[["month_number"]],
        train_data["total_expense"],
    )

    return model, data


def predict_next_month_from_data(monthly_expenses):
    """Train on supplied monthly totals and predict the next month."""

    if len(monthly_expenses) < 3:
        return {
            "status": "insufficient_data",
            "predicted_expense": None,
            "months_used": len(monthly_expenses),
        }

    values = pd.to_numeric(
        pd.Series(monthly_expenses),
        errors="raise",
    )

    if (
        values.isna().any()
        or not values.map(math.isfinite).all()
        or (values < 0).any()
    ):
        raise ValueError(
            "Expenses must be finite, non-negative numbers."
        )

    X = list(range(len(values)))
    model = LinearRegression()
    model.fit(
        pd.DataFrame({"month_number": X}),
        values,
    )

    prediction = model.predict(
        pd.DataFrame({"month_number": [len(values)]})
    )[0]

    return {
        "status": "success",
        "predicted_expense": round(max(0.0, float(prediction)), 2),
        "months_used": len(values),
        "model": "LinearRegression",
    }


if __name__ == "__main__":
    model, data = train_model()
    print("Model trained successfully!")
    print(f"Training months: {len(data) - 4}")
    print("Evaluation months: 4")
    print("Model: Linear Regression")
