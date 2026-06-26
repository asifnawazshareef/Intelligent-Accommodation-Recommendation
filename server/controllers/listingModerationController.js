import Property from "../models/Property.js";

export const getPendingListings = async (req, res, next) => {
  try {
    const properties = await Property.find({ status: "pending" })
      .populate("owner", "name email")
      .sort({ createdAt: -1 });

    res.json({
      success: true,
      count: properties.length,
      data: properties,
    });
  } catch (error) {
    next(error);
  }
};

export const approveListing = async (req, res, next) => {
  try {
    const property = await Property.findById(req.params.id);

    if (!property) {
      res.status(404);
      throw new Error("Property not found");
    }

    if (property.status !== "pending") {
      res.status(400);
      throw new Error("Only pending listings can be approved");
    }

    property.status = "approved";
    await property.save();

    const updatedProperty = await Property.findById(property._id).populate(
      "owner",
      "name email",
    );

    res.json({
      success: true,
      message: "Property approved successfully",
      data: updatedProperty,
    });
  } catch (error) {
    next(error);
  }
};

export const rejectListing = async (req, res, next) => {
  try {
    const property = await Property.findById(req.params.id);

    if (!property) {
      res.status(404);
      throw new Error("Property not found");
    }

    if (property.status !== "pending") {
      res.status(400);
      throw new Error("Only pending listings can be rejected");
    }

    property.status = "rejected";
    await property.save();

    const updatedProperty = await Property.findById(property._id).populate(
      "owner",
      "name email",
    );

    res.json({
      success: true,
      message: "Property rejected successfully",
      data: updatedProperty,
    });
  } catch (error) {
    next(error);
  }
};
