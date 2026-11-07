// Narration for the demo video: one entry per chapter, short sentences that name the feature and say the result.
// AI judges read the frames and the transcript, so every chapter must make sense from its narration alone.

export interface ChapterScript {
  id: string;
  title: string;
  lines: string[];
}

export const INTRO: ChapterScript = {
  id: "intro",
  title: "Share surplus food with neighbours in 30 seconds",
  lines: ["FreshShare: share surplus food with neighbours, recorded live in the real app."],
};

export const OUTRO: ChapterScript = {
  id: "outro",
  title: "Try it at freshshare.de",
  lines: ["FreshShare is live at freshshare dot de. Scan the code to try it."],
};

export const CHAPTERS: ChapterScript[] = [
  {
    id: "landing",
    title: "Landing page and early access",
    lines: ["The landing page shows the problem and live impact numbers from the database.", "A visitor joins early access as a fridge host, and gets a thank-you."],
  },
  {
    id: "signup",
    title: "Sign up with terms",
    lines: ["Sign-up needs a sixteen-plus check and the terms.", "Decline blocks the account; I Accept creates it, and the server stores when the terms were accepted."],
  },
  {
    id: "verify",
    title: "Get verified, get food alerts",
    lines: ["A new neighbour confirms email and phone, marked as demo, and gets the Verified badge.", "Then switches on food alerts near home, by distance and kind of food."],
  },
  {
    id: "post",
    title: "Post food in 30 seconds",
    lines: ["Anna picks the bread template, adds a photo, and ticks the safety checklist.", "Photo and best-before date are required. She posts in well under thirty seconds."],
  },
  {
    id: "browse",
    title: "Browse and map",
    lines: ["Food and community fridges within two kilometres, with place search and clustered pins.", "The list view has search and filters, and visitors only see an approximate area."],
  },
  {
    id: "claim",
    title: "Claim, confirm, address reveal",
    lines: [
      "Sara, on the right, reserves Anna's food. Only one claim can win; the server checks it atomically.",
      "Anna confirms, and only now does Sara see the exact address.",
    ],
  },
  {
    id: "chat",
    title: "Real-time chat",
    lines: ["Sara's message appears on Anna's screen instantly, and the reply comes straight back."],
  },
  {
    id: "pickup",
    title: "Pickup code, complete and rate",
    lines: ["Sara shows a QR and six-digit pickup code. Anna enters it, and the handover is collected.", "Both rate each other, which feeds each profile's star average."],
  },
  {
    id: "notifications",
    title: "Notifications",
    lines: ["Someone reserves this giver's food, and the bell count goes up, live.", "The notification says who wants what."],
  },
  {
    id: "fridges",
    title: "Community fridges",
    lines: ["Sara checks in at a community fridge: half full, with what's inside.", "Her check-in shows in the fridge history."],
  },
  {
    id: "orgs",
    title: "Organizations and bulk pickup",
    lines: ["Food banks have team roles: admin, manager, volunteer and viewer.", "A manager requests two listings in one run, and a volunteer ticks them off as collected."],
  },
  {
    id: "admin",
    title: "Admin and safety",
    lines: ["The admin rejects a fridge suggestion, approves a new organization, and dismisses a report.", "Early-access sign-ups are counted by role and source, with a CSV export."],
  },
  {
    id: "impact",
    title: "Your impact",
    lines: ["Every profile shows its impact in portions, kilograms and CO2, as a shareable card."],
  },
  {
    id: "recurring",
    title: "Recurring listings",
    lines: ["A bakery's bread comes every week, so Anna repeats her listing on Monday, Wednesday and Friday. It's posted fresh on those days."],
  },
  {
    id: "extras",
    title: "Waitlist and blocking",
    lines: ["Food already reserved? Ben joins the waitlist as number one.", "And blocking someone hides their food from your map."],
  },
  {
    id: "phone",
    title: "On your phone",
    lines: ["The same web app works in a phone browser, with a list view and bottom sheets."],
  },
  {
    id: "stack",
    title: "Under the hood",
    lines: [
      "React and Vite, an Express API with Prisma and PostgreSQL, on AWS with ECS, RDS, S3, CloudFront and SES, built with Terraform.",
      "Here is the live health check, and a listing photo served from S3.",
    ],
  },
];
