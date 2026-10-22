
import pandas as pd
from sklearn.linear_model import LinearRegression
from sklearn.metrics import mean_absolute_error, mean_squared_error

from ml.train_model import DATA_FILE


def evaluate_model():
    data = pd.read_csv(DATA_FILE)
    data["month"] = pd.to_datetime(data["month"])
    data = data.sort_values("month").reset_index(drop=True)

    data["month_number"] = range(len(data))

    # Keep the last 4 months for testing.
    train_data = data.iloc[:-4]
    test_data = data.iloc[-4:]

    model = LinearRegression()
    model.fit(
        train_data[["month_number"]],
        train_data["total_expense"],
    )

    predictions = model.predict(test_data[["month_number"]])

    # Baseline: predict each month using the previous month's actual expense.
    baseline_predictions = (
        data["total_expense"]
        .iloc[-5:-1]
        .to_numpy()
    )

    actual = test_data["total_expense"].to_numpy()

    model_mae = mean_absolute_error(actual, predictions)
    model_rmse = mean_squared_error(
        actual, predictions
    ) ** 0.5

    baseline_mae = mean_absolute_error(
        actual, baseline_predictions
    )
    baseline_rmse = mean_squared_error(
    actual, baseline_predictions
    ) ** 0.5


    print("Evaluation uses synthetic data only.")
    print("\nActual vs predicted expenses:")

    for month, actual_value, predicted_value in zip(
        test_data["month"],
        actual,
        predictions,
    ):
        print(
            f"{month:%Y-%m}: "
            f"Actual = {actual_value:.2f}, "
            f"Predicted = {max(0, predicted_value):.2f}"
        )

    print(f"\nLinear Regression MAE: {model_mae:.2f}")
    print(f"Linear Regression RMSE: {model_rmse:.2f}")
    print(f"Baseline MAE: {baseline_mae:.2f}")
    print(f"Baseline RMSE: {baseline_rmse:.2f}")

    if model_mae < baseline_mae:
        print("Result: Linear Regression performed better on this test.")
    elif model_mae > baseline_mae:
        print("Result: Baseline performed better on this test.")
    else:
        print("Result: Both methods had equal MAE on this test.")


if __name__ == "__main__":
    evaluate_model()
