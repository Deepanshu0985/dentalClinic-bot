// Facts used by the website and the bot. Swap these (and knowledge/) to
// re-skin the demo for another business.
export const clinic = {
  name: "Brightsmile Dental",
  tagline: "Gentle, modern dentistry for the whole family",
  city: "Austin, Texas",
  address: "2400 Lakeview Drive, Suite 110, Austin, TX 78701",
  phone: "(512) 555-0147",
  phoneHref: "tel:+15125550147",
  email: "hello@brightsmile-dental.example",
  hours: [
    { days: "Mon – Thu", time: "8:00 AM – 6:00 PM" },
    { days: "Friday", time: "8:00 AM – 4:00 PM" },
    { days: "Saturday", time: "9:00 AM – 1:00 PM" },
    { days: "Sunday", time: "Closed" },
  ],
  assistantName: "Ava",
} as const;

export const treatments = [
  "Check-up & cleaning",
  "Teeth whitening",
  "Invisalign",
  "Dental implants",
  "Fillings",
  "Crowns & bridges",
  "Root canal",
  "Extraction / wisdom teeth",
  "Children's dentistry",
  "Veneers",
  "Emergency",
  "Other",
] as const;
