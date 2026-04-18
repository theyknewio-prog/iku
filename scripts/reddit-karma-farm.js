/**
 * Reddit Karma Farmer — Paste this in Chrome DevTools console on reddit.com
 *
 * Comments on hot posts in NSFW subs every 10 minutes.
 * Leave it running overnight → wake up with karma.
 *
 * Usage: Open reddit.com → F12 → Console → Paste this entire script → Enter
 */

(async function karmaFarmer() {
  const INTERVAL_MS = 10 * 60 * 1000; // 10 minutes between comments
  const SUBS = [
    "ecchi",
    "hentai",
    "rule34",
    "thighdeology",
    "AraAra",
    "BigAnimeTiddies",
    "AnimeBooty",
    "pantsu",
    "nsfwanimegifs",
    "animelegs",
  ];

  // Natural-sounding comments that get upvotes on NSFW subs
  const COMMENTS = [
    "the lighting in this is *chef's kiss*",
    "this artist is so underrated",
    "absolutely gorgeous work",
    "the detail on this is incredible",
    "need more of this artist fr",
    "best one I've seen today",
    "the colors are stunning",
    "this artist keeps delivering",
    "masterpiece honestly",
    "saving this one for sure",
    "god tier shading",
    "the anatomy is perfect here",
    "just wow",
    "this hits different",
    "they really outdid themselves with this one",
    "perfection",
    "the pose is so well done",
    "incredible talent",
    "obsessed with this art style",
    "this is peak",
  ];

  const commented = new Set();
  let totalComments = 0;
  let totalKarmaEst = 0;

  function getToken() {
    try {
      return JSON.parse(localStorage.getItem("chat:access-token")).token;
    } catch {
      console.error("❌ No Reddit token found. Make sure you are logged in.");
      return null;
    }
  }

  async function getHotPosts() {
    const token = getToken();
    if (!token) return [];

    const sub = SUBS[Math.floor(Math.random() * SUBS.length)];
    try {
      const resp = await fetch(
        `https://oauth.reddit.com/r/${sub}/hot?limit=10`,
        {
          headers: { Authorization: `Bearer ${token}` },
        },
      );
      const data = await resp.json();
      return (data.data?.children || [])
        .filter((c) => !c.data.stickied && c.data.ups > 50)
        .map((c) => ({
          id: c.data.name,
          title: c.data.title,
          ups: c.data.ups,
          sub: c.data.subreddit,
          comments: c.data.num_comments,
        }));
    } catch (e) {
      console.error("Failed to fetch posts:", e);
      return [];
    }
  }

  async function postComment(postId, text) {
    const token = getToken();
    if (!token) return false;

    const fd = new URLSearchParams();
    fd.append("api_type", "json");
    fd.append("thing_id", postId);
    fd.append("text", text);

    try {
      const resp = await fetch("https://oauth.reddit.com/api/comment", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: fd.toString(),
      });
      const data = await resp.json();
      const errors = data.json?.errors || [];
      if (errors.length) {
        const errMsg = errors[0][1];
        if (errMsg.includes("Take a break")) {
          const mins = errMsg.match(/(\d+) minutes/);
          console.log(
            `⏳ Rate limited. Waiting ${mins ? mins[1] : "?"} more minutes...`,
          );
        } else {
          console.log(`❌ Error: ${errMsg}`);
        }
        return false;
      }
      return true;
    } catch (e) {
      console.error("Comment failed:", e);
      return false;
    }
  }

  async function doOneComment() {
    const posts = await getHotPosts();
    if (!posts.length) {
      console.log("⚠️ No posts found, will retry next cycle");
      return;
    }

    // Find a post we haven't commented on yet
    const post = posts.find((p) => !commented.has(p.id));
    if (!post) {
      console.log(
        "⚠️ Already commented on all hot posts, will retry next cycle",
      );
      return;
    }

    const comment = COMMENTS[Math.floor(Math.random() * COMMENTS.length)];

    console.log(
      `\n💬 Commenting on r/${post.sub}: "${post.title.substring(0, 50)}..." (${post.ups} ups)`,
    );
    console.log(`   Comment: "${comment}"`);

    const success = await postComment(post.id, comment);
    if (success) {
      commented.add(post.id);
      totalComments++;
      totalKarmaEst += Math.floor(post.ups * 0.02); // rough estimate
      console.log(
        `✅ Comment #${totalComments} posted! Est. karma earned: ~${totalKarmaEst}`,
      );
    }
  }

  // Start
  console.log("🚀 Reddit Karma Farmer started!");
  console.log(`📋 ${SUBS.length} subs, ${COMMENTS.length} comment templates`);
  console.log(`⏰ Commenting every ${INTERVAL_MS / 60000} minutes`);
  console.log("🛑 To stop: window.__stopKarmaFarm = true\n");

  // First comment immediately
  await doOneComment();

  // Then every 10 minutes
  const interval = setInterval(async () => {
    if (window.__stopKarmaFarm) {
      clearInterval(interval);
      console.log(
        `\n🛑 Karma Farmer stopped. Total: ${totalComments} comments, ~${totalKarmaEst} karma est.`,
      );
      return;
    }
    await doOneComment();
  }, INTERVAL_MS);

  // Store reference for cleanup
  window.__karmaFarmInterval = interval;
  window.__stopKarmaFarm = false;
})();
