const express = require("express");
const axios = require("axios");

const app = express();

const GUARDIAN_API_KEY = "5d91941a-914e-4aef-b6d7-d7ba278dd4ee";
const ENDPOINT_URL = "https://content.guardianapis.com/search";

app.get("/", async (req, res) => {
  try {
    const response = await axios.get(ENDPOINT_URL, {
      params: {
        "api-key": GUARDIAN_API_KEY,
        "page-size": 5,
        "order-by": "newest",
        "show-fields": "trailText,headline",
        "section": "world"
      }
    });

    // Equivalent to:
    // data.get("response", {}).get("results", [])

    const results = response.data?.response?.results || [];

    res.json(results);

  } catch (error) {
    console.error(error.message);
    res.status(500).json({ error: "Failed to fetch news" });
  }
});

app.listen(3000, () => {
  console.log("Server running on port 3000");
});