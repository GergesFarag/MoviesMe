// Test Firebase notification data conversion
// Run this to verify your notification data will work with Firebase

function testNotificationDataConversion(data) {
  console.log("Original data:", data);
  
  // This is the same conversion logic now used in notifications.ts
  const stringifiedData = {};
  if (data) {
    Object.keys(data).forEach(key => {
      const value = data[key];
      if (value !== null && value !== undefined) {
        stringifiedData[key] = String(value);
      }
    });
  }

  // Validate that all data values are now strings
  const invalidValues = Object.entries(stringifiedData).filter(([key, value]) => typeof value !== 'string');
  if (invalidValues.length > 0) {
    console.error("❌ Non-string values found:", invalidValues);
    return false;
  }

  console.log("✅ Converted data:", stringifiedData);
  console.log("✅ All values are strings:", Object.entries(stringifiedData).map(([k, v]) => `${k}: ${typeof v}`));
  return true;
}

// Test cases
console.log("=== Testing Story Notification Data ===");

// Test story notification data (the problematic case)
const storyNotificationData = {
  storyId: "64a7b8c9d0e1f2a3b4c5d6e7", // string
  jobId: "job_123456789", // string
  status: "completed", // string
  userId: "64a7b8c9d0e1f2a3b4c5d6e8", // string
  redirectTo: "/storiesDetails" // string
};

testNotificationDataConversion(storyNotificationData);

console.log("\n=== Testing Mixed Data Types ===");

// Test with mixed data types that might cause issues
const mixedData = {
  id: 123, // number
  isComplete: true, // boolean
  timestamp: new Date(), // Date object
  nested: { prop: "value" }, // object
  array: [1, 2, 3], // array
  nullValue: null, // null
  undefinedValue: undefined, // undefined
  stringValue: "test" // string
};

testNotificationDataConversion(mixedData);

console.log("\n=== Testing Edge Cases ===");

// Test edge cases
const edgeCases = {
  emptyString: "",
  zero: 0,
  falsy: false,
  bigNumber: 999999999999999,
  specialChars: "test@#$%^&*()",
};

testNotificationDataConversion(edgeCases);