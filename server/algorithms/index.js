module.exports = {
  ...require("./db-migrate"),
  ...require("./specialty-tree"),
  ...require("./equipment-catalog"),
  ...require("./file-metadata"),
  ...require("./equipment-create"),
  ...require("./equipment-update"),
  ...require("./scan-log"),
  ...require("./equipment-delete"),
};
