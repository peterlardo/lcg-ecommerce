const https = require("https");
const fs = require("fs");
const path = require("path");

const images = [
  {
    url: "https://lcglacons.lovable.app/__l5e/assets-v1/9ed804e6-b746-4963-964c-e12b10a872c7/logo-lcg.jpeg",
    dest: "public/logo-lcg.jpeg",
  },
  {
    url: "https://lcglacons.lovable.app/assets/hero-ice-DxCOCedj.jpg",
    dest: "public/assets/hero-ice.jpg",
  },
  {
    url: "https://lcglacons.lovable.app/assets/product-cubes-B66g8ElW.jpg",
    dest: "public/assets/product-cubes.jpg",
  },
  {
    url: "https://lcglacons.lovable.app/assets/product-cylindres-BJ2BN85U.jpg",
    dest: "public/assets/product-cylindres.jpg",
  },
  {
    url: "https://lcglacons.lovable.app/assets/product-pilee-CtfczW5a.jpg",
    dest: "public/assets/product-pilee.jpg",
  },
  {
    url: "https://lcglacons.lovable.app/assets/product-spheres-BPrh0pL8.jpg",
    dest: "public/assets/product-spheres.jpg",
  },
  {
    url: "https://lcglacons.lovable.app/assets/product-bloc-DoEZtgVm.jpg",
    dest: "public/assets/product-bloc.jpg",
  },
  {
    url: "https://lcglacons.lovable.app/assets/product-sac-CEfsMTQS.jpg",
    dest: "public/assets/product-sac.jpg",
  },
  {
    url: "https://lcglacons.lovable.app/assets/production-Dmxv42AK.jpg",
    dest: "public/assets/production.jpg",
  },
];

function download(url, dest) {
  return new Promise((resolve, reject) => {
    const dir = path.dirname(dest);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    const file = fs.createWriteStream(dest);
    https
      .get(url, (response) => {
        response.pipe(file);
        file.on("finish", () => {
          file.close();
          console.log(`✓ ${dest}`);
          resolve();
        });
      })
      .on("error", (err) => {
        fs.unlink(dest, () => {});
        reject(err);
      });
  });
}

(async () => {
  for (const img of images) {
    try {
      await download(img.url, img.dest);
    } catch (err) {
      console.error(`✗ ${img.dest}: ${err.message}`);
    }
  }
  console.log("Done!");
})();
