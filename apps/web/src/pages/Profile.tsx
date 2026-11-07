import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { fetchImpact, fetchMyClaims, logout, updateProfile, verifyEmail, verifyPhone, type Me } from "../api/client";
import { LocationPicker } from "../components/LocationPicker";
import { ErrorNote, inputCls, labelCls, Page, primaryBtn } from "../components/Page";
import { Stars } from "../components/Stars";
import { VerifiedBadge } from "../components/VerifiedBadge";
import { useMe } from "../hooks/useMe";
import { formatDay } from "../lib/format";

const demoTag = <span className="ml-1 rounded bg-accent px-1.5 py-0.5 text-[10px] font-bold text-white">DEMO</span>;

export function Profile() {
  const me = useMe();
  const qc = useQueryClient();
  const nav = useNavigate();
  const claims = useQuery({ queryKey: ["claims"], queryFn: fetchMyClaims });
  const impact = useQuery({
    queryKey: ["impact", "me", me.data?.id],
    queryFn: () => fetchImpact(me.data!.homeLat, me.data!.homeLng, 2000),
    enabled: !!me.data,
  });
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const onUser = { onSuccess: (u: unknown) => qc.setQueryData(["me"], u) };
  const phoneM = useMutation({ mutationFn: () => verifyPhone(phone, code), ...onUser });
  const emailM = useMutation({ mutationFn: verifyEmail, ...onUser });
  const u = me.data;
  if (!u) return null;

  const history = [...(claims.data?.asReceiver ?? []), ...(claims.data?.asGiver ?? [])]
    .filter((c) => c.status === "collected")
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  return (
    <Page title="Profile">
      <div className="space-y-5">
        <section className="flex items-center gap-4 rounded-2xl bg-white p-4 ring-1 ring-stone-200">
          <span className="flex h-14 w-14 items-center justify-center rounded-full bg-brand text-2xl font-bold text-white">{u.name.charAt(0)}</span>
          <div className="space-y-1">
            <p className="text-lg font-bold">{u.name}</p>
            <div className="flex flex-wrap items-center gap-2">
              {u.verified && <VerifiedBadge />}
              <Stars avg={u.ratingAvg} count={u.ratingCount} />
            </div>
            <Link to={`/users/${u.id}`} className="text-sm font-semibold text-brand-dark underline">See your public profile</Link>
          </div>
        </section>

        <EditProfile key={u.id} user={u} />

        <section className="grid grid-cols-3 gap-2 text-center">
          {[
            ["Listed", u.stats.shared],
            ["Given", u.stats.given],
            ["Received", u.stats.received],
          ].map(([label, n]) => (
            <div key={label} className="rounded-2xl bg-white p-3 ring-1 ring-stone-200">
              <p className="text-2xl font-extrabold text-brand-dark">{n}</p>
              <p className="text-xs text-stone-600">{label}</p>
            </div>
          ))}
        </section>

        {impact.data?.me && (
          <p className="rounded-xl bg-brand-light p-3 text-sm text-brand-dark">
            🌱 You've helped save <strong>{impact.data.me.portionsGiven + impact.data.me.portionsReceived} portions</strong> (~{impact.data.me.kg} kg,
            estimate at 0.4 kg per portion)
          </p>
        )}

        {!u.verified && (
          <section className="space-y-3 rounded-2xl bg-white p-4 ring-1 ring-stone-200">
            <h2 className="font-bold">Get your Verified badge</h2>
            <p className="text-sm text-stone-600">Neighbours trust verified givers more. It takes two steps.</p>
            <div className="flex items-center justify-between">
              <span className="text-sm">1. Email {u.emailVerified ? "✓ confirmed" : ""}</span>
              {!u.emailVerified && (
                <button className="min-h-[40px] rounded-full px-4 text-sm font-semibold ring-1 ring-stone-300" onClick={() => emailM.mutate()}>
                  Confirm email {demoTag}
                </button>
              )}
            </div>
            <div>
              <span className="text-sm">2. Phone {u.phoneVerified ? "✓ confirmed" : ""}</span>
              {!u.phoneVerified && (
                <div className="mt-2 space-y-2">
                  <label className={labelCls} htmlFor="phone">Phone number</label>
                  <input id="phone" type="tel" className={inputCls} value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+49 170 1234567" />
                  <label className={labelCls} htmlFor="code">
                    Code from SMS {demoTag}
                  </label>
                  <input id="code" inputMode="numeric" className={inputCls} value={code} onChange={(e) => setCode(e.target.value)} placeholder="DEMO code: 123456" />
                  <button className={primaryBtn} onClick={() => phoneM.mutate()} disabled={!phone || !code || phoneM.isPending}>
                    Verify phone
                  </button>
                  <p className="text-xs text-stone-500">DEMO: no SMS is sent today. Use code 123456.</p>
                </div>
              )}
            </div>
            <ErrorNote error={phoneM.error ?? emailM.error} />
          </section>
        )}

        <section>
          <h2 className="mb-2 text-sm font-bold text-stone-700">Pickup history</h2>
          <div className="space-y-2">
            {history.length === 0 && <p className="text-sm text-stone-500">No completed pickups yet.</p>}
            {history.map((c) => (
              <Link key={c.id} to={`/pickups/${c.id}`} className="flex items-center gap-3 rounded-2xl bg-white p-2 ring-1 ring-stone-200">
                <img src={c.listing.photoUrl} alt="" className="h-12 w-12 rounded-xl object-cover" loading="lazy" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold">{c.listing.title}</p>
                  <p className="text-xs text-stone-600">
                    {c.role === "receiver" ? `Received from ${c.listing.giver.name}` : `Given to ${c.receiver.name}`} · {formatDay(c.createdAt)}
                  </p>
                </div>
                {c.myRating && <span className="text-sm text-accent">{"★".repeat(c.myRating)}</span>}
              </Link>
            ))}
          </div>
        </section>

        <button
          className="w-full min-h-[48px] rounded-full text-sm font-semibold text-stone-600 ring-1 ring-stone-300"
          onClick={async () => {
            await logout();
            qc.setQueryData(["me"], null);
            nav("/");
          }}
        >
          Sign out
        </button>
      </div>
    </Page>
  );
}

function EditProfile({ user }: { user: Me }) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(user.name);
  const [bio, setBio] = useState(user.bio ?? "");
  const [home, setHome] = useState({ lat: user.homeLat, lng: user.homeLng });
  const m = useMutation({
    mutationFn: () => updateProfile({ name, bio: bio.trim() || null, homeLat: home.lat, homeLng: home.lng }),
    onSuccess: (u) => {
      qc.setQueryData(["me"], u);
      qc.invalidateQueries({ queryKey: ["user", u.id] });
    },
  });
  if (!open)
    return (
      <section className="flex items-center justify-between gap-3 rounded-2xl bg-white p-4 ring-1 ring-stone-200">
        <p className="min-w-0 text-sm text-stone-700">{user.bio ? user.bio : <span className="text-stone-500">Add a short bio so neighbours know who you are.</span>}</p>
        <button className="shrink-0 min-h-[40px] rounded-full px-4 text-sm font-semibold ring-1 ring-stone-300" onClick={() => setOpen(true)}>
          Edit profile
        </button>
      </section>
    );
  return (
    <form
      className="space-y-4 rounded-2xl bg-white p-4 ring-1 ring-stone-200"
      onSubmit={(e) => {
        e.preventDefault();
        m.mutate();
      }}
    >
      <h2 className="font-bold">Edit profile</h2>
      <div>
        <label className={labelCls} htmlFor="p-name">Name</label>
        <input id="p-name" required minLength={2} maxLength={60} className={inputCls} value={name} onChange={(e) => setName(e.target.value)} />
      </div>
      <div>
        <label className={labelCls} htmlFor="p-bio">Bio</label>
        <textarea id="p-bio" maxLength={300} rows={3} className={inputCls} value={bio} onChange={(e) => setBio(e.target.value)} placeholder="e.g. Family of four, we often have too much fruit." />
        <p className="mt-1 text-xs text-stone-500">{300 - bio.length} characters left. Shown on your public profile.</p>
      </div>
      <div>
        <span className={labelCls}>Home location</span>
        <LocationPicker value={home} onChange={setHome} />
        <p className="mt-1 text-xs text-stone-500">Tap the map to move your pin. Neighbours never see the exact spot.</p>
      </div>
      <ErrorNote error={m.error} />
      {m.isSuccess && <p role="status" className="rounded-xl bg-brand-light p-3 text-sm text-brand-dark">Saved. Your profile is up to date.</p>}
      <div className="flex gap-2">
        <button className={primaryBtn} disabled={m.isPending}>{m.isPending ? "Saving…" : "Save profile"}</button>
        <button type="button" className="min-h-[48px] rounded-full px-5 text-sm font-semibold ring-1 ring-stone-300" onClick={() => setOpen(false)}>
          Close
        </button>
      </div>
    </form>
  );
}
