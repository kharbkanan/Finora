
import numpy as np
import pandas as pd

from sklearn.linear_model import LinearRegression
from sklearn.metrics import mean_absolute_error, mean_squared_error

# 1. Generate 24 months of synthetic expense data
np.random.seed(42)

months = pd.date_range(
    start="2024-11-01",
    periods=24,
    freq="MS"
)

month_number = np.arange(1, 25)

expenses = (
    3000
    + 60 * month_number
    + np.random.normal(0, 120, 24)
)

df = pd.DataFrame({
    "month": months,
    "month_number": month_number,
    "expense": expenses
})

print("Evaluation uses synthetic data only.")

# 2. Split chronologically: 18 months for training, 6 for testing
train = df.iloc[:18].copy()
test = df.iloc[18:].copy()

X_train = train[["month_number"]]
y_train = train["expense"]

X_test = test[["month_number"]]
y_test = test["expense"]

# 3. Train Linear Regression
model = LinearRegression()
model.fit(X_train, y_train)

predictions = model.predict(X_test)

# 4. Baseline: previous month's actual expense
baseline_predictions = df["expense"].iloc[17:23].to_numpy()

# 5. Evaluate both methods
lr_mae = mean_absolute_error(y_test, predictions)
lr_rmse = np.sqrt(mean_squared_error(y_test, predictions))

baseline_mae = mean_absolute_error(
    y_test, baseline_predictions
)

baseline_rmse = np.sqrt(
    mean_squared_error(y_test, baseline_predictions)
)

# 6. Display actual and predicted expenses
results = pd.DataFrame({
    "month": test["month"].dt.strftime("%Y-%m"),
    "actual_expense": y_test.to_numpy(),
    "predicted_expense": predictions,
    "baseline_expense": baseline_predictions
})

print("\nActual vs predicted expenses:")
print(results.round(2).to_string(index=False))

print("\nModel Evaluation:")
print(f"Linear Regression MAE: {lr_mae:.2f}")
print(f"Linear Regression RMSE: {lr_rmse:.2f}")
print(f"Baseline MAE: {baseline_mae:.2f}")
print(f"Baseline RMSE: {baseline_rmse:.2f}")

if lr_mae < baseline_mae:
    print("Result: Linear Regression performed better.")
else:
    print("Result: Baseline performed better or equally.")
