
function deepSerialize(value) {
  if (value === null || value === undefined) {
    return value; // handle null and undefined
  }

  // If the value is an object or array, we recursively serialize its properties
  if (Array.isArray(value)) {
    return value.map(deepSerialize); // Serialize array elements recursively
  } else if (typeof value === 'object') {
    const serializedObject = {};
    for (let key in value) {
      if (value.hasOwnProperty(key)) {
        serializedObject[key] = deepSerialize(value[key]); // Recursively serialize each property
      }
    }
    return serializedObject;
  }

  // Otherwise, return the primitive value (string, number, etc.)
  return value
}

module.exports = { deepSerialize }