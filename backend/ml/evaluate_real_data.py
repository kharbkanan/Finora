
from pathlib import Path

import numpy as np
import pandas as pd
from sklearn.linear_model import LinearRegression
from sklearn.metrics import mean_absolute_error, mean_squared_error

DATA_FILE = Path(__file__).parent / "sample_expenses.csv"


def main():
    # Load and validate the data
    data = pd.read_csv(DATA_FILE)
    data["month"] = pd.to_datetime(data["month"])
    data = data.sort_values("month").reset_index(drop=True)

    if data["month"].duplicated().any():
        raise ValueError("Each month must appear only once.")

    if data["total_expense"].isna().any():
        raise ValueError("Expense data contains missing values.")

    if (data["total_expense"] < 0).any():
        raise ValueError("Expenses cannot be negative.")

    if len(data) < 8:
        raise ValueError("At least 8 months are required.")

    # Reserve the last 4 months for testing
    train = data.iloc[:-4].copy()
    test = data.iloc[-4:].copy()

    # Use a chronological month number
    train["month_number"] = np.arange(len(train))
    test["month_number"] = np.arange(len(train), len(data))

    # Train the model
    model = LinearRegression()
    model.fit(train[["month_number"]], train["total_expense"])

    # Predict the four unseen months
    predictions = model.predict(test[["month_number"]])

    # Baseline: predict each month using the previous month's expense
    baseline_predictions = data["total_expense"].iloc[-5:-1].to_numpy()

    # Compare results
    results = pd.DataFrame({
        "month": test["month"].dt.strftime("%Y-%m"),
        "actual": test["total_expense"].to_numpy(),
        "predicted": predictions.round(2),
        "baseline_previous_month": baseline_predictions,
    })

    model_mae = mean_absolute_error(test["total_expense"], predictions)
    model_rmse = np.sqrt(
        mean_squared_error(test["total_expense"], predictions)
    )

    baseline_mae = mean_absolute_error(
        test["total_expense"], baseline_predictions
    )
    baseline_rmse = np.sqrt(
        mean_squared_error(test["total_expense"], baseline_predictions)
    )

    print("Evaluation uses the CSV data; verify whether it is real or sample data.")
    print("\nActual vs Predicted:")
    print(results.to_string(index=False))

    print("\nModel comparison")
    print(f"Linear Regression MAE: {model_mae:.2f}")
    print(f"Linear Regression RMSE: {model_rmse:.2f}")
    print(f"Baseline MAE: {baseline_mae:.2f}")
    print(f"Baseline RMSE: {baseline_rmse:.2f}")

    if model_mae < baseline_mae:
        print("\nLinear Regression performed better on MAE.")
    elif model_mae > baseline_mae:
        print("\nPrevious-month baseline performed better on MAE.")
    else:
        print("\nBoth approaches have equal MAE.")


if __name__ == "__main__":
    main()
