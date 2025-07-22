const { logger } = require('~/config');

const options = [
  {
    label: 'com_ui_garment',
    value: 'garment',
  },
  {
    label: 'com_ui_accessories',
    value: 'accessories',
  },
  {
    label: 'com_ui_kids',
    value: 'kids',
  },
  {
    label: 'com_ui_underwear',
    value: 'underwear',
  },
  {
    label: 'com_ui_scarf',
    value: 'scarf',
  },
  {
    label: 'com_ui_kitchen',
    value: 'kitchen',
  },
  {
    label: 'com_ui_shoes',
    value: 'shoes',
  },
  {
    label: 'com_ui_decoration',
    value: 'decoration',
  },
  {
    label: 'com_ui_others',
    value: 'others',
  },
];

module.exports = {
  /**
   * Retrieves the categories asynchronously.
   * @returns {Promise<TGetCategoriesResponse>} An array of category objects.
   * @throws {Error} If there is an error retrieving the categories.
   */
  getCategories: async () => {
    try {
      // const categories = await Categories.find();
      return options;
    } catch (error) {
      logger.error('Error getting categories', error);
      return [];
    }
  },
};
