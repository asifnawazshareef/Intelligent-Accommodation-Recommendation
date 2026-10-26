import { Faker, en } from "@faker-js/faker";
import { recipe, stableId } from "./config.js";
import { catalogProperties, supervisorProperties } from "./pakistanCatalog.js";
const day = 86400000;
const date = (base, offset) =>
  new Date(new Date(base).getTime() + offset * day).toISOString().slice(0, 10);
const timestamp = (base, offset) =>
  new Date(new Date(base).getTime() + offset * day);
const comments = {
  positive: [
    "The room was spotless and the staff were helpful.",
    "The bed was comfortable and the location was convenient.",
    "Breakfast was fresh and the service was excellent.",
  ],
  negative: [
    "The room was dirty and the staff were unhelpful.",
    "The room was noisy and the bed was uncomfortable.",
    "The wifi failed and the service was disappointing.",
  ],
  neutral: [
    "The room was acceptable and the service was ordinary.",
    "It was a standard stay with basic facilities.",
    "The location and price were about average.",
  ],
  mixed: [
    "The staff were friendly, but the room was noisy.",
    "The location was excellent, but the bathroom was dirty.",
    "The bed was comfortable, but the wifi was unreliable.",
  ],
};
export function fixture(faker, sentiment, nights) {
  const rating =
    sentiment === "positive"
      ? faker.number.int({ min: 4, max: 5 })
      : sentiment === "negative"
        ? faker.number.int({ min: 1, max: 2 })
        : 3;
  return {
    rating,
    text: `${faker.helpers.arrayElement(comments[sentiment])}${nights ? ` We stayed for ${nights} nights.` : ""}`,
    sentiment,
    sentimentScore: 0,
    aspects: [],
    aspectInsights: [],
    summary: "Synthetic demo feedback. Not a model prediction.",
  };
}
export function buildDataset(namespace, input, generation = "initial") {
  const c = recipe(input);
  const faker = new Faker({ locale: [en] });
  faker.seed(c.seed);
  faker.setDefaultRefDate(`${c.referenceDate}T00:00:00.000Z`);
  const items = [];
  const owners = [];
  const guests = [];
  const properties = [];
  const approved = Math.floor((c.properties * c.approvedPercent) / 100);
  const reviewLimit = c.supervisorDemo ? Math.max(8, Math.ceil(c.reviews / Math.max(approved, 1)) * 2) : 0;
  const earliest = -((c.supervisorDemo ? reviewLimit : Math.ceil(c.reviews / Math.max(approved, 1))) * 7 + 60);
  const add = (entity, key, payload, rate) => {
    const logicalKey = `${generation}:${key}`;
    const item = {
      entity,
      key: logicalKey,
      payload: { _id: stableId(namespace, logicalKey), ...payload },
      ...(rate != null && { rate }),
    };
    items.push(item);
    return item.payload;
  };
  for (const [role, count, target] of [
    ["owner", c.owners, owners],
    ["guest", c.guests, guests],
  ]) {
    for (let i = 0; i < count; i++)
      target.push(
        add("users", `${role}:${i}`, {
          name: faker.person.fullName(),
          email: `${role}.${stableId(namespace, generation, String(i))}@example.test`,
          role,
          phone: "",
          isVerified: true,
          languagePref: "en",
          createdAt: timestamp(c.referenceDate, earliest - 30),
          updatedAt: timestamp(c.referenceDate, earliest - 30),
        }),
      );
  }
  const catalog = c.supervisorDemo ? supervisorProperties(c.cities, c.catalogDigest)
    : ["pakistan_v1", "pakistan_collected_v1"].includes(c.propertySource) ? catalogProperties(c.cities, c.propertySource, c.catalogDigest) : null;
  for (let i = 0; i < c.properties; i++) {
    const real = catalog?.[i];
    const city = faker.helpers.arrayElement(c.cities);
    properties.push(
      add("properties", `property:${i}`, {
        title: `${faker.word.adjective()} ${faker.helpers.arrayElement(["Guest House", "City Apartment", "Family Suite", "Mountain Lodge"])} in ${city}`,
        description: `${faker.lorem.sentences(2)} Comfortable rooms, parking and wifi. Synthetic FYP listing.`,
        location: {
          address: `${faker.location.buildingNumber()} ${faker.location.street()}`,
          city,
          country: "Pakistan",
        },
        price: faker.number.int({ min: c.minPrice, max: c.maxPrice }),
        owner: owners[i % owners.length]._id,
        status: i < approved ? "approved" : i % 2 ? "pending" : "rejected",
        images: [
          {
            url: "/seed/property.svg",
            verificationStatus: i < approved ? "verified" : "pending",
            aiScore: 0,
            uploadedAt: timestamp(c.referenceDate, earliest - 20),
          },
        ],
        availabilityCalendar: [
          {
            startDate: date(c.referenceDate, earliest),
            endDate: date(c.referenceDate, 365),
          },
        ],
        ...(real && {
          title: real.title,
          description: real.description,
          location: { address: real.address, city: real.city, country: "Pakistan" },
          seedCatalog: { id: real.id, sourceUrl: real.sourceUrl, checkedAt: real.checkedAt },
          images: real.images.map(({ url, caption, credit }) => ({
            url, caption, credit: structuredClone(credit),
            verificationStatus: i < approved ? "verified" : "pending",
            aiScore: 0,
            uploadedAt: timestamp(c.referenceDate, earliest - 20),
          })),
        }),
        createdAt: timestamp(c.referenceDate, earliest - 20),
        updatedAt: timestamp(c.referenceDate, earliest - 20),
      }),
    );
  }
  const assignments = [];
  if (c.supervisorDemo) {
    const counts = Array(approved).fill(0);
    for (let i = 0; i < Math.min(c.reviews, approved); i++) {
      assignments.push(i);
      counts[i]++;
    }
    while (assignments.length < c.reviews) {
      const index = faker.number.int({ min: 0, max: approved - 1 });
      if (counts[index] >= reviewLimit) continue;
      assignments.push(index);
      counts[index]++;
    }
  }
  const previousReviews = Array(approved).fill(0);
  for (let i = 0; i < c.reviews; i++) {
    const propertyIndex = c.supervisorDemo ? assignments[i] : i % approved;
    const p = properties[propertyIndex];
    const guest = guests[i % guests.length];
    const offset = -(previousReviews[propertyIndex]++ * 7 + 14);
    const nights = faker.number.int({ min: 1, max: 5 });
    const booking = add(
      "bookings",
      `booking:${i}`,
      {
        guest: guest._id,
        property: p._id,
        startDate: date(c.referenceDate, offset),
        endDate: date(c.referenceDate, offset + nights),
        guests: faker.number.int({ min: 1, max: 4 }),
        totalAmount: p.price * nights,
        status: "confirmed",
        paymentStatus: "confirmed",
        paymentMethod: "demo",
        paymentConfirmedAt: timestamp(c.referenceDate, offset - 1),
        createdAt: timestamp(c.referenceDate, offset - 2),
        updatedAt: timestamp(c.referenceDate, offset - 1),
      },
      p.price,
    );
    const roll = faker.number.int({ min: 0, max: 99 });
    const sentiment = c.supervisorDemo && i < 4 ? ["positive", "negative", "neutral", "mixed"][i] :
      roll < c.positivePercent
        ? "positive"
        : roll < c.positivePercent + c.negativePercent
          ? "negative"
          : roll < c.positivePercent + c.negativePercent + c.neutralPercent
            ? "neutral"
            : "mixed";
    const feedback = fixture(faker, sentiment, nights);
    add("reviews", `review:${i}`, {
      booking: booking._id,
      guest: guest._id,
      property: p._id,
      ...feedback,
      ...(catalog && { text: `Demo review, not a real guest experience. ${feedback.text}` }),
      createdAt: timestamp(c.referenceDate, offset + nights + 1),
      updatedAt: timestamp(c.referenceDate, offset + nights + 1),
    });
  }
  const order = ["users", "properties", "bookings", "reviews"];
  return items.sort(
    (a, b) => order.indexOf(a.entity) - order.indexOf(b.entity),
  );
}
