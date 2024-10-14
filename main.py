# Import required libraries
import pandas as pd
import joblib
from sklearn.model_selection import train_test_split
from sklearn.ensemble import RandomForestClassifier
from sklearn.metrics import classification_report, accuracy_score

# Load the dataset
data = pd.read_csv('transaction_dataset.csv')

# Drop irrelevant columns
columns_to_keep = ['FLAG', 'Avg min between sent tnx', 'Avg min between received tnx',
                   'Time Diff between first and last (Mins)', 'Sent tnx', 'Received Tnx',
                   'total Ether sent', 'total ether received']
data = data[columns_to_keep]

# Split data into features and target
X = data.drop('FLAG', axis=1)
y = data['FLAG']

# Split into training and test sets
X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.3, random_state=42)

# Initialize Random Forest model
model = RandomForestClassifier(n_estimators=100, random_state=42)

# Train the model
model.fit(X_train, y_train)
joblib.dump(model,'fraud_detection_model.pkl')
# Make predictions
y_pred = model.predict(X_test)

# Evaluate the model
print(f"Accuracy: {accuracy_score(y_test, y_pred)}")
print(classification_report(y_test, y_pred))
