// ---------------------- CONFIG ----------------------

// Countries & number formats
const countriesConfig = {
    US: {
        label: "United States",
        countryCode: "+1",
        usesNanpa: true,
        defaultArea: "806",
        minAreaLen: 3,
        maxAreaLen: 3,
    },
    CA: {
        label: "Canada",
        countryCode: "+1",
        usesNanpa: true,
        defaultArea: "416",
        minAreaLen: 3,
        maxAreaLen: 3,
    },
    UK: {
        label: "United Kingdom",
        countryCode: "+44",
        usesNanpa: false,
        defaultArea: "20", // London
        minAreaLen: 2,
        maxAreaLen: 4,
    },
    AU: {
        label: "Australia",
        countryCode: "+61",
        usesNanpa: false,
        defaultArea: "4", // mobile prefix
        minAreaLen: 1,
        maxAreaLen: 2,
    },
    DE: {
        label: "Germany",
        countryCode: "+49",
        usesNanpa: false,
        defaultArea: "30", // Berlin
        minAreaLen: 2,
        maxAreaLen: 4,
    }
};

const STORAGE_KEY = "globalNumberGenSettings_v1";

let nanpaPrefixes = {};        // loaded from prefixes.json
let generatedContacts = [];    // {name, phone}
let usedNames = new Set();     // to keep names unique

// Bigger name pools for more unique combos
const firstNames = [
    "John","Emma","Noah","Ava","Mason","Olivia","Sophia","James","Mia","Elijah",
    "Isabella","Ethan","Harper","Logan","Aria","Liam","Charlotte","Amelia","Alexander","Evelyn",
    "Benjamin","Abigail","Michael","Emily","Daniel","Elizabeth","Henry","Sofia","Jackson","Avery",
    "Sebastian","Ella","Jack","Grace","Owen","Chloe","Wyatt","Victoria","Luke","Riley",
    "Jayden","Zoey","Gabriel","Lily","Carter","Hannah","Julian","Layla","Leo","Nora",
    "Isaac","Scarlett","Grayson","Penelope","Hudson","Lillian","Levi","Zoey","Mateo","Stella",
    "David","Paisley","Joseph","Addison","Samuel","Aurora","Caleb","Brooklyn","Ryan","Savannah",
    "Matthew","Lucy","Isaiah","Audrey","Nathan","Bella","Dylan","Claire","Eli","Skylar",
    "Hunter","Sadie","Lincoln","Anna","Anthony","Hailey","Andrew","Allison","Thomas","Natalie"
];

const lastNames = [
    "Smith","Johnson","Williams","Brown","Jones","Garcia","Miller","Davis","Rodriguez","Martinez",
    "Hernandez","Lopez","Gonzalez","Wilson","Anderson","Thomas","Taylor","Moore","Jackson","Martin",
    "Lee","Perez","Thompson","White","Harris","Sanchez","Clark","Ramirez","Lewis","Robinson",
    "Walker","Young","Allen","King","Wright","Scott","Torres","Nguyen","Hill","Flores",
    "Green","Adams","Nelson","Baker","Hall","Rivera","Campbell","Mitchell","Carter","Roberts",
    "Gomez","Phillips","Evans","Turner","Diaz","Parker","Cruz","Edwards","Collins","Reyes",
    "Stewart","Morris","Morales","Murphy","Cook","Rogers","Gutierrez","Ortiz","Morgan","Cooper",
    "Peterson","Bailey","Reed","Kelly","Howard","Ramos","Kim","Cox","Ward","Richardson",
    "Watson","Brooks","Chavez","Wood","James","Bennett","Gray","Mendoza","Ruiz","Hughes"
];

// ---------------------- UTILS ----------------------

function $(id) {
    return document.getElementById(id);
}

function showLoader(show, message) {
    const loader = $("loader");
    if (!loader) return;
    loader.style.display = show ? "flex" : "none";
    if (message) loader.querySelector("p").textContent = message;
}

function setTheme(mode) {
    const body = document.body;
    body.classList.remove("dark", "light");
    body.classList.add(mode);
    $("themeToggle").checked = (mode === "light");
    persistSettings();
}

function getCurrentTheme() {
    return document.body.classList.contains("light") ? "light" : "dark";
}

function randomItem(arr) {
    return arr[Math.floor(Math.random() * arr.length)];
}

function uniqueName() {
    let name;
    let tries = 0;
    while (true) {
        name = `${randomItem(firstNames)} ${randomItem(lastNames)}`;
        if (!usedNames.has(name)) {
            usedNames.add(name);
            return name;
        }
        tries++;
        if (tries > 50) {
            // fallback, append number
            name = `${name} ${Math.floor(Math.random() * 100000)}`;
            if (!usedNames.has(name)) {
                usedNames.add(name);
                return name;
            }
        }
    }
}

function randomLine4() {
    return String(Math.floor(Math.random() * 9999 + 1)).padStart(4, "0");
}

function randomDigits(n) {
    let s = "";
    for (let i = 0; i < n; i++) {
        s += Math.floor(Math.random() * 10);
    }
    return s;
}

function generateUniversalPrefixes() {
    const p = [];
    for (let i = 200; i < 1000; i++) {
        const s = String(i);
        if (s[0] !== "0" && s[0] !== "1") p.push(s);
    }
    return p;
}

// ---------------------- NANPA PREFIX LOADING ----------------------

function loadNanpaPrefixes(areaCode, serverMode, countryCode) {
    const row = document.querySelector(".nanpa-only");
    const select = $("prefixSelect");

    if (!countriesConfig[countryCode].usesNanpa) {
        // hide row for non-NANPA
        row.classList.add("hidden");
        select.innerHTML = "";
        return;
    }

    row.classList.remove("hidden");
    select.innerHTML = "";

    const universal = generateUniversalPrefixes();

    let list = [];
    if (serverMode === "A") {
        list = universal;
    } else if (serverMode === "B") {
        list = nanpaPrefixes[areaCode] || [];
    } else { // C hybrid
        list = nanpaPrefixes[areaCode] || universal;
    }

    if (list.length === 0) {
        // fallback universal if nothing
        list = universal;
    }

    list.forEach(p => {
        const opt = document.createElement("option");
        opt.value = p;
        opt.textContent = p;
        select.appendChild(opt);
    });
}

// ---------------------- COUNTRY NUMBER GENERATORS ----------------------

function generateNanpaNumber(countryCode, areaCode, prefix) {
    const conf = countriesConfig[countryCode];
    const cc = conf.countryCode;
    // For NANPA, we require 3-digit area code (but we trust the user)
    const line = randomLine4();
    return `${cc}${areaCode}${prefix}${line}`;
}

function generateUKNumber(areaCodeInput) {
    const cc = countriesConfig.UK.countryCode;
    let area = areaCodeInput.replace(/\D/g, "");
    if (area.length < 2) area = countriesConfig.UK.defaultArea;
    if (area[0] === "0") area = area.slice(1); // UK numbers typically without leading 0 after +44
    // Simplified UK pattern: +44 7XXX XXXXXX for mobile-like or +44 area local
    if (area[0] === "7") {
        const rest = randomDigits(8);
        return `${cc}${area}${rest}`;
    } else {
        const localLen = 9 - area.length;
        const localPart = randomDigits(Math.max(localLen, 5));
        return `${cc}${area}${localPart}`;
    }
}

function generateAUNumber(areaCodeInput) {
    const cc = countriesConfig.AU.countryCode;
    let area = areaCodeInput.replace(/\D/g, "");
    if (!area || area[0] !== "4") {
        area = "4"; // mobile pattern
    }
    // Mobile style: +61 4XX XXX XXX
    const needed = 8 - area.length; // total digits (4 + 8) after +61
    const rest = randomDigits(Math.max(needed, 6));
    return `${cc}${area}${rest}`;
}

function generateDENumber(areaCodeInput) {
    const cc = countriesConfig.DE.countryCode;
    let area = areaCodeInput.replace(/\D/g, "");
    if (area.length < 2) area = countriesConfig.DE.defaultArea; // 30 (Berlin)
    // Simplified DE pattern: +49 area + 7-digit local
    const local = randomDigits(7);
    return `${cc}${area}${local}`;
}

// ---------------------- MAIN GENERATOR ----------------------

function runGenerator() {
    const country = $("countrySelect").value;
    const conf = countriesConfig[country];

    let area = $("areaCode").value.trim();
    const serverMode = $("serverMode").value;
    const limit = parseInt($("limit").value, 10);
    const prefix = $("prefixSelect").value;

    if (!limit || limit < 1 || limit > 20000) {
        alert("Please enter a valid amount between 1 and 20,000.");
        return;
    }

    if (conf.usesNanpa) {
        if (!/^\d{3}$/.test(area)) {
            alert("For US/Canada, please enter a 3-digit area code (e.g., 806).");
            return;
        }
    } else {
        // Non-NANPA: soft validation only
        area = area.replace(/\D/g, "");
        if (!area) {
            area = conf.defaultArea;
        }
    }

    usedNames.clear();
    generatedContacts = [];

    const large = limit > 2000;
    if (large) {
        showLoader(true, "Generating " + limit + " numbers…");
    }

    setTimeout(() => {
        for (let i = 0; i < limit; i++) {
            const name = uniqueName();
            let phone;

            if (conf.usesNanpa) {
                let usePrefix = prefix;
                if (!usePrefix) {
                    // In case user didn't have it loaded, pick universal
                    usePrefix = randomItem(generateUniversalPrefixes());
                }
                phone = generateNanpaNumber(country, area, usePrefix);
            } else {
                if (country === "UK") phone = generateUKNumber(area);
                else if (country === "AU") phone = generateAUNumber(area);
                else if (country === "DE") phone = generateDENumber(area);
                else phone = "+0000000000"; // fallback
            }

            generatedContacts.push({ name, phone });
        }

        $("output").textContent = generatedContacts
            .map(c => `${c.name} — ${c.phone}`)
            .join("\n");

        $("csvBtn").style.display = "inline-block";
        $("vcfBtn").style.display = "inline-block";

        persistSettings();
        if (large) showLoader(false);
    }, large ? 50 : 0);
}

// ---------------------- EXPORTS ----------------------

function downloadCSV() {
    if (!generatedContacts.length) return;
    let csv = "Name,Phone\n";
    generatedContacts.forEach(c => {
        csv += `${c.name},${c.phone}\n`;
    });
    const blob = new Blob([csv], { type: "text/csv" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "contacts.csv";
    a.click();
}

function downloadVCF() {
    if (!generatedContacts.length) return;
    let vcf = "";
    generatedContacts.forEach(c => {
        vcf += `BEGIN:VCARD
VERSION:3.0
FN:${c.name}
TEL;TYPE=CELL:${c.phone}
END:VCARD
`;
    });
    const blob = new Blob([vcf], { type: "text/vcard" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "contacts.vcf";
    a.click();
}

// ---------------------- LOCAL STORAGE ----------------------

function persistSettings() {
    const data = {
        country: $("countrySelect").value,
        serverMode: $("serverMode").value,
        areaCode: $("areaCode").value,
        limit: $("limit").value,
        theme: getCurrentTheme()
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

function loadSettings() {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (!raw) return;
        const data = JSON.parse(raw);
        if (data.country) $("countrySelect").value = data.country;
        if (data.serverMode) $("serverMode").value = data.serverMode;
        if (data.areaCode) $("areaCode").value = data.areaCode;
        if (data.limit) $("limit").value = data.limit;

        const theme = data.theme || "dark";
        setTheme(theme);
    } catch (e) {
        console.warn("Couldn't load settings:", e);
    }
}

// ---------------------- INIT ----------------------

document.addEventListener("DOMContentLoaded", () => {
    // Theme toggle
    $("themeToggle").addEventListener("change", (e) => {
        setTheme(e.target.checked ? "light" : "dark");
    });

    // Country / mode changes
    $("countrySelect").addEventListener("change", () => {
        const country = $("countrySelect").value;
        const conf = countriesConfig[country];
        if (!$("areaCode").value.trim()) {
            $("areaCode").value = conf.defaultArea;
        }
        loadNanpaPrefixes($("areaCode").value, $("serverMode").value, country);
        persistSettings();
    });

    $("serverMode").addEventListener("change", () => {
        const country = $("countrySelect").value;
        loadNanpaPrefixes($("areaCode").value, $("serverMode").value, country);
        persistSettings();
    });

    $("areaCode").addEventListener("input", () => {
        const country = $("countrySelect").value;
        const conf = countriesConfig[country];
        if (conf.usesNanpa) {
            const ac = $("areaCode").value.replace(/\D/g, "").slice(0, 3);
            $("areaCode").value = ac;
            if (ac.length === 3) {
                loadNanpaPrefixes(ac, $("serverMode").value, country);
            }
        }
        persistSettings();
    });

    // Quick limits
    document.querySelectorAll(".quick-limits button").forEach(btn => {
        btn.addEventListener("click", () => {
            $("limit").value = btn.getAttribute("data-limit");
            persistSettings();
        });
    });

    $("generateBtn").addEventListener("click", runGenerator);
    $("csvBtn").addEventListener("click", downloadCSV);
    $("vcfBtn").addEventListener("click", downloadVCF);

    // Load prefixes.json then settings
    showLoader(true, "Loading prefix database…");
    fetch("prefixes.json")
        .then(res => res.json())
        .then(data => {
            nanpaPrefixes = data;
        })
        .catch(err => {
            console.error("Error loading prefixes.json", err);
        })
        .finally(() => {
            loadSettings();
            // Init NANPA prefix dropdown if relevant
            const country = $("countrySelect").value || "US";
            const conf = countriesConfig[country];
            if (!$("areaCode").value.trim()) {
                $("areaCode").value = conf.defaultArea;
            }
            loadNanpaPrefixes($("areaCode").value, $("serverMode").value, country);
            showLoader(false);
        });
});
