export const defaults = {
  users: () => ({
    name: "",
    email: "",
    phone: "",
    role: "guest",
    languagePref: "en",
    isVerified: true,
  }),
  properties: () => ({
    title: "",
    description: "",
    location: { address: "", city: "Islamabad", country: "Pakistan" },
    price: 5000,
    owner: "",
    status: "pending",
    images: [
      { url: "/seed/property.svg", verificationStatus: "pending", aiScore: 0 },
    ],
    availabilityCalendar: [],
  }),
  bookings: () => ({
    guest: "",
    property: "",
    startDate: "",
    endDate: "",
    guests: 1,
    status: "confirmed",
    paymentStatus: "confirmed",
  }),
  reviews: () => ({ booking: "", text: "", rating: 3, sentiment: "neutral" }),
};
export function editable(entity, record) {
  const result = defaults[entity]();
  for (const k of Object.keys(result))
    if (record[k] !== undefined) result[k] = structuredClone(record[k]);
  if (entity === "bookings" && record.rate != null) result.rate = record.rate;
  return result;
}
