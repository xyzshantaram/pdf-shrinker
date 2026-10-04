import { Head } from "fresh/runtime";
import { define } from "../utils.ts";
import Shrinker from "../islands/Shrinker.tsx";

export default define.page(function Home() {
  return (
    <>
      <Head>
        <title>PDF Shrinker</title>
        <meta
          name="description"
          content="Shrink PDFs with Ghostscript. Uploads are ephemeral and discarded after conversion."
        />
      </Head>
      <main class="page">
        <header class="intro">
          <h1>Shrink a PDF</h1>
          <p class="lede">
            Drop in a PDF, get a smaller one back. Your upload is deleted the
            moment it&rsquo;s converted; the result is deleted the moment you
            download it.
          </p>
        </header>
        <Shrinker />
        <footer class="foot">
          Runs server-side with Ghostscript.
        </footer>
      </main>
    </>
  );
});
