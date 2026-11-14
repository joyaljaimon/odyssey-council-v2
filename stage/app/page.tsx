// Landing page: number, tagline, characters, how it works.
import type { Character } from "@odyssey/contracts";
import charactersJson from "@odyssey/story/data/characters.json";

const characters = charactersJson as Character[];
const NUMBER = process.env.NEXT_PUBLIC_AGENT_NUMBER;

export default function Home() {
  return (
    <main className="landing">
      <header>
        <h1>Homer&apos;s Odyssey</h1>
        <p className="tagline">Every great solution begins with an Odyssey.</p>
        <p className="cta">
          Text or FaceTime{" "}
          {NUMBER ? <a href={`sms:${NUMBER}`}><strong>{NUMBER}</strong></a> : <strong>our number (coming soon)</strong>}
          {" "}and tell a character from the Odyssey what you&apos;re struggling with.
        </p>
      </header>

      <section className="cast">
        {characters.map((c) => (
          <article key={c.id}>
            <div className="portrait">
              <img src={`/assets/characters/${c.id}/body.png`} alt={c.name} />
              <img src={`/assets/characters/${c.id}/mouth-0.png`} alt="" />
            </div>
            <h2>{c.name}</h2>
            <p>{c.sampleLines[1] ?? c.sampleLines[0]}</p>
          </article>
        ))}
      </section>

      <section className="how">
        <h2>How it works</h2>
        <ol>
          <li><b>Tell your storm.</b> Procrastination, a hard choice, a toxic friend, grief.</li>
          <li><b>Hear your episode.</b> The Sirens, the Lotus Eaters, Scylla and Charybdis: the character tells the part of the Odyssey that matches, quoting the real text.</li>
          <li><b>Watch it on FaceTime.</b> On calls the character talks on a live stage with the passage highlighted and the scene or the map.</li>
          <li><b>Take home your Ithaca.</b> One lesson and one action for this week, on a card you can keep.</li>
        </ol>
        <p className="fine">The characters are AI and say so. Calls are not recorded. Quotes come from Samuel Butler&apos;s 1900 translation.</p>
        <p><a href="/stage?sessionId=demo&debug=1">Open the stage (demo)</a> · <a href="/characters">Character styles</a> · <a href="/card?sessionId=example">Sample card</a></p>
      </section>
    </main>
  );
}
