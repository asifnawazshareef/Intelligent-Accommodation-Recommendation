import Property from "../models/Property.js";

export const createTestProperty = async (req, res) => {
  try {
    const { title, city, price } = req.body;

    if (!title || !city) {
      return res.status(400).json({ success: false, message: "title and city are required." });
    }

    const property = await Property.create({ title, city, price: Number(price || 0) });

    return res.status(201).json({ success: true, data: property });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const getTestProperties = async (req, res) => {
  try {
    const properties = await Property.find().sort({ createdAt: -1 });
    return res.json({ success: true, data: properties });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};
