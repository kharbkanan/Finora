
import pandas as pd
import numpy as np
from sklearn.linear_model import LinearRegression
from sklearn.metrics import mean_absolute_error, mean_squared_error

from ml.train_model import DATA_FILE


def evaluate_walk_forward():
    data = pd.read_csv(DATA_FILE)
    data["month"] = pd.to_datetime(data["month"])
    data = data.sort_values("month").reset_index(drop=True)

    if data["month"].isna().any():
        raise ValueError("Month data contains missing values.")

    if data["month"].duplicated().any():
        raise ValueError("Each month must appear only once.")

    expenses = pd.to_numeric(
        data["total_expense"], errors="raise"
    )

    if expenses.isna().any():
        raise ValueError("Expense data contains missing values.")

    if not np.isfinite(expenses).all():
        raise ValueError("Expenses must be finite numbers.")

    if (expenses < 0).any():
        raise ValueError("Expenses cannot be negative.")

    data["total_expense"] = expenses

    if len(data) < 7:
        raise ValueError("At least 7 months of data is required.")

    data["month_number"] = range(len(data))

    actual_values = []
    model_predictions = []
    baseline_predictions = []
    test_months = []

    # Start with at least 6 training months.
    for test_index in range(6, len(data)):
        train_data = data.iloc[:test_index]
        test_row = data.iloc[test_index]

        model = LinearRegression()
        model.fit(
            train_data[["month_number"]],
            train_data["total_expense"],
        )

        prediction = model.predict(
            test_row[["month_number"]].to_frame().T
        )[0]

        actual = float(test_row["total_expense"])
        previous_month_expense = float(
            data.iloc[test_index - 1]["total_expense"]
        )

        actual_values.append(actual)
        model_predictions.append(max(0.0, float(prediction)))
        baseline_predictions.append(previous_month_expense)
        test_months.append(test_row["month"])

    model_mae = mean_absolute_error(
        actual_values, model_predictions
    )
    model_rmse = mean_squared_error(
        actual_values, model_predictions
    ) ** 0.5

    baseline_mae = mean_absolute_error(
        actual_values, baseline_predictions
    )
    baseline_rmse = mean_squared_error(
        actual_values, baseline_predictions
    ) ** 0.5

    print("Walk-forward evaluation uses synthetic data.")
    print(f"Training starts with 6 months.")
    print(f"Test months evaluated: {len(actual_values)}")

    print("\nActual vs predicted expenses:")
    for month, actual, predicted in zip(
        test_months, actual_values, model_predictions
    ):
        print(
            f"{month:%Y-%m}: "
            f"Actual = {actual:.2f}, "
            f"Predicted = {predicted:.2f}"
        )

    print(f"\nLinear Regression MAE: {model_mae:.2f}")
    print(f"Linear Regression RMSE: {model_rmse:.2f}")
    print(f"Baseline MAE: {baseline_mae:.2f}")
    print(f"Baseline RMSE: {baseline_rmse:.2f}")

    if model_mae < baseline_mae:
        print("Result: Linear Regression performed better.")
    elif model_mae > baseline_mae:
        print("Result: Baseline performed better.")
    else:
        print("Result: Both methods had equal MAE.")


if __name__ == "__main__":
    evaluate_walk_forward()
