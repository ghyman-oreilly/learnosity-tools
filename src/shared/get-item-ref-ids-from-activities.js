
function getItemReferenceIdsFromActivities(activities) {
  try {
    let itemRefs = [];

    activities.forEach(activity => {
      items = activity.data.items;
      items.forEach(item => {
        itemRefs.push(`${item}`);
      })
    });
    
    return itemRefs
  } catch (error) {
    console.error('Error obtaining item reference IDs from activity bodies: ', error);
    throw error;
  }
}

module.exports = getItemReferenceIdsFromActivities;