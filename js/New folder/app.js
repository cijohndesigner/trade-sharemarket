let isNavOpen = true;
// cj cruz – personal trade tracker
// Fully offline trading journal using localStorage + Chart.js

(function () {
    "use strict";
    
    const PASSWORD = "cjcruz";
    const THEME_KEY = "cj_trader_theme";

    const PROFILE_IMAGE_KEY = "cj_trader_profile_image";
    const PROFILE_NAME_KEY = "cj_trader_profile_name";

    const STORAGE_KEYS = {
        MAIN_BALANCE: "cj_trader_main_balance",
        AVAILABLE_BALANCE: "cj_trader_available_balance",
        MANUAL_ADJUST: "cj_trader_manual_adjustment",
        TRADES: "cj_trader_trades",
        DEPOSITS_WITHDRAWALS: "cj_trader_dw",
        SNAPSHOTS: "cj_trader_snapshots"
		
    };

    const tradeFilterState = {
        income: 'all',
        dateRange: "all",
        symbolFilter: "",
        side: "all",
        minPL: null,
        maxPL: null
    };

    let equityChartInstance = null;

    // Symbol point value (multiplier per 1 point move per 1 quantity)
    // Adjust these numbers if your broker / contract sizes are different.
    const SYMBOL_POINT_VALUE = {
        "Gold": 10,
        "Gold 10": 1,
        "Silver": 1,
        "Nifty 50": 1,
        "Bank Nifty": 1,
        "Custom": 1
    };

    // ----------------- Utilities -----------------

    function formatCurrency(value) {
        const num = Number(value) || 0;
        const sign = num < 0 ? "-" : "";
        const absVal = Math.abs(num);
        return `${sign}₹${absVal.toLocaleString("en-IN", {
            maximumFractionDigits: 2,
            minimumFractionDigits: 2
        })}`;
    }

    function formatDateDisplay(dateStr) {
        if (!dateStr) return "";
        const d = new Date(dateStr);
        if (isNaN(d.getTime())) return dateStr;
        return d.toLocaleDateString("en-IN", {
            day: "2-digit",
            month: "short",
            year: "2-digit"
        });
    }

    function getTodayISO() {
        const today = new Date();
        const y = today.getFullYear();
        const m = String(today.getMonth() + 1).padStart(2, "0");
        const d = String(today.getDate()).padStart(2, "0");
        return `${y}-${m}-${d}`;
    }

    function showToast(message, type = "neutral") {
        const container = document.getElementById("toastContainer");
        if (!container) return;

        // Only one toast at a time (looks cleaner in center)
        container.innerHTML = "";

        const toast = document.createElement("div");
        const kind =
            type === "success"
                ? "cj-toast-success"
                : type === "danger"
                ? "cj-toast-danger"
                : "cj-toast-neutral";

        toast.className = `cj-toast ${kind}`;
        toast.innerHTML = `<span>${message}</span><button type="button" class="cj-toast-close">✅</button>`;

        container.appendChild(toast);

        // trigger scale+fade animation
        requestAnimationFrame(() => {
            toast.classList.add("show");
        });

        function removeToast() {
            toast.classList.remove("show");
            setTimeout(() => {
                if (toast.parentNode && toast.parentNode === container) {
                    container.removeChild(toast);
                }
            }, 200);
        }

        const closeBtn = toast.querySelector(".cj-toast-close");
        if (closeBtn) {
            closeBtn.addEventListener("click", removeToast);
        }

        setTimeout(removeToast, 2800);
    }


    function requirePassword(reasonLabel) {
        const input = window.prompt(
            `Password required to ${reasonLabel}.\n\nEnter password:`
        );
        if (input === null) return false;
        if (input === PASSWORD) return true;
        alert("Incorrect password.");
        return false;
    }

        function openPasswordModal(reasonLabel, onSuccess) {
        const backdrop = document.getElementById("passwordModalBackdrop");
        const titleEl = document.getElementById("passwordModalTitle");
        const subtitleEl = document.getElementById("passwordModalSubtitle");
        const inputEl = document.getElementById("passwordModalInput");
        const errorEl = document.getElementById("passwordModalError");
        const formEl = document.getElementById("passwordModalForm");
        const cancelBtn = document.getElementById("passwordModalCancel");
        const submitBtn = document.getElementById("passwordModalSubmit");
        const viewEl = document.getElementById("passwordModalView");
        const copyBtn = document.getElementById("passwordModalCopy");
        
        // Fallback to old prompt if modal pieces missing
        if (!backdrop || !formEl || !inputEl || !cancelBtn) {
            if (requirePassword(reasonLabel) && typeof onSuccess === "function") {
                onSuccess();
            }
            return;
        }

        if (viewEl) {
            viewEl.value = PASSWORD;
        }
        if (inputEl) {
            inputEl.type = "text";
            inputEl.value = "";
        }
        if (errorEl) errorEl.textContent = "";

        const label = (reasonLabel || "").toLowerCase();
        const isDelete = label.includes("delete");

        // Configure title
        if (titleEl) {
            if (isDelete) {
                titleEl.textContent = "Confirm Delete";
            } else if (label.includes("edit main balance")) {
                titleEl.textContent = "Main Balance";
            } else if (label.includes("edit available balance")) {
                titleEl.textContent = "Available Balance";
            } else if (label.includes("edit manual adjustment")) {
                titleEl.textContent = "Manual Adjustment";
            } else if (label.includes("reset all data")) {
                titleEl.textContent = "Confirm Reset";
            } else {
                titleEl.textContent = "Security Check";
            }
        }

        // Configure subtitle
        if (subtitleEl) {
            if (isDelete) {
                subtitleEl.textContent = "Enter password to confirm deletion.";
            } else if (label.includes("edit main balance")) {
                subtitleEl.textContent = "Password required to edit main balance.";
            } else if (label.includes("edit available balance")) {
                subtitleEl.textContent = "Password required to edit available balance.";
            } else if (label.includes("edit manual adjustment")) {
                subtitleEl.textContent = "Password required to edit manual adjustment.";
            } else if (label.includes("reset all data")) {
                subtitleEl.textContent = "Password required to reset all data.";
            } else {
                subtitleEl.textContent = `Password required to ${reasonLabel}.`;
            }
        }

        // Configure submit button text + color
        if (submitBtn) {
    let buttonLabel = "Confirm";

    if (isDelete) {
        buttonLabel = "Delete";
    } else if (label.includes("edit main balance")) {
        buttonLabel = "Update";
    } else if (label.includes("edit available balance")) {
        buttonLabel = "Update";
    } else if (label.includes("edit manual adjustment")) {
        buttonLabel = "Adjust";
    } else if (label.includes("reset all data")) {
        buttonLabel = "Reset";
    }

    submitBtn.textContent = buttonLabel;
    submitBtn.classList.remove("btn-danger", "btn-primary");
    submitBtn.classList.add(isDelete ? "btn-danger" : "btn-primary");
}



        function cleanup() {
            formEl.removeEventListener("submit", onSubmit);
            cancelBtn.removeEventListener("click", onCancel);
            document.removeEventListener("keydown", onKeyDown);
            if (copyBtn) copyBtn.removeEventListener("click", onCopyClick);
                    }

        function onCopyClick(e) {
            e.preventDefault();
            if (!viewEl) return;
            try {
                viewEl.select();
                viewEl.setSelectionRange(0, viewEl.value.length);
                document.execCommand("copy");
                showToast("Password copied", "success");
            } catch (err) {}
        }

                function close() {
            backdrop.classList.remove("show");
            cleanup();
        }

        function handleSuccess() {
            close();
            if (typeof onSuccess === "function") onSuccess();
        }

        function onSubmit(e) {
            e.preventDefault();
            const value = inputEl.value || "";
            if (value === PASSWORD) {
                handleSuccess();
            } else {
                if (errorEl) errorEl.textContent = "Incorrect password.";
                inputEl.select();
            }
        }

        function onCancel(e) {
            e.preventDefault();
            close();
        }

        function onKeyDown(e) {
            if (e.key === "Escape") {
                e.preventDefault();
                close();
            }
        }

        if (copyBtn) copyBtn.addEventListener("click", onCopyClick);
        formEl.addEventListener("submit", onSubmit);
        cancelBtn.addEventListener("click", onCancel);
        document.addEventListener("keydown", onKeyDown);

        backdrop.classList.add("show");
        if (inputEl) inputEl.focus();
    }
    function openBalanceEditModal(config) {
        const backdrop = document.getElementById("balanceEditBackdrop");
        const titleEl = document.getElementById("balanceEditTitle");
        const subtitleEl = document.getElementById("balanceEditSubtitle");
        const labelTextEl = document.getElementById("balanceEditLabelText");
        const inputEl = document.getElementById("balanceEditInput");
        const errorEl = document.getElementById("balanceEditError");
        const formEl = document.getElementById("balanceEditForm");
        const cancelBtn = document.getElementById("balanceEditCancel");
        const submitBtn = document.getElementById("balanceEditSubmit");

        if (
            !backdrop ||
            !titleEl ||
            !subtitleEl ||
            !labelTextEl ||
            !inputEl ||
            !errorEl ||
            !formEl ||
            !cancelBtn ||
            !submitBtn
        ) {
            // Fallback to simple prompt if modal pieces missing
            const current = typeof config.currentValue === "number"
                ? config.currentValue
                : 0;
            const input = window.prompt(config.promptText || "Enter new value:", String(current));
            if (input === null) return;
            const value = Number(input);
            if (Number.isNaN(value)) {
                alert("Invalid number.");
                return;
            }
            if (!config.allowNegative && value < 0) {
                alert("Value cannot be negative.");
                return;
            }
            if (typeof config.onSave === "function") {
                config.onSave(value);
            }
            return;
        }

        const title = config.titleText || "Update";
        const subtitle = config.subtitleText || "Enter the new value.";
        const labelText = config.labelText || "New value";
        const allowNegative = !!config.allowNegative;
        const currentValue =
            typeof config.currentValue === "number" && !Number.isNaN(config.currentValue)
                ? config.currentValue
                : 0;

        titleEl.textContent = title;
        subtitleEl.textContent = subtitle;
        labelTextEl.textContent = labelText;
        inputEl.value = String(currentValue);
        errorEl.textContent = "";

        function close() {
            backdrop.classList.remove("show");
            cleanup();
        }

        function handleSave(value) {
            close();
            if (typeof config.onSave === "function") {
                config.onSave(value);
            }
        }

        function onSubmit(e) {
            e.preventDefault();
            const raw = inputEl.value.trim();
            if (!raw) {
                errorEl.textContent = "Value is required.";
                inputEl.focus();
                return;
            }
            const value = Number(raw);
            if (Number.isNaN(value)) {
                errorEl.textContent = "Please enter a valid number.";
                inputEl.focus();
                inputEl.select();
                return;
            }
            if (!allowNegative && value < 0) {
                errorEl.textContent = "Value cannot be negative.";
                inputEl.focus();
                inputEl.select();
                return;
            }
            handleSave(value);
        }

        function onCancel(e) {
            e.preventDefault();
            close();
        }

        function onKeyDown(e) {
            if (e.key === "Escape") {
                e.preventDefault();
                close();
            }
        }

        function onBackdropClick(e) {
            if (e.target === backdrop) {
                e.preventDefault();
                close();
            }
        }

        function cleanup() {
            formEl.removeEventListener("submit", onSubmit);
            cancelBtn.removeEventListener("click", onCancel);
            document.removeEventListener("keydown", onKeyDown);
            backdrop.removeEventListener("click", onBackdropClick);
        }

        formEl.addEventListener("submit", onSubmit);
        cancelBtn.addEventListener("click", onCancel);
        document.addEventListener("keydown", onKeyDown);
        backdrop.addEventListener("click", onBackdropClick);

        backdrop.classList.add("show");
        inputEl.focus();
        inputEl.select();
    }


function loadNumber(key, defaultValue = 0) {
        const raw = localStorage.getItem(key);
        if (raw === null || raw === undefined || raw === "") return defaultValue;
        const num = Number(raw);
        if (Number.isNaN(num)) return defaultValue;
        return num;
    }

    function saveNumber(key, value) {
        localStorage.setItem(key, String(Number(value) || 0));
    }

    function loadArray(key) {
        const raw = localStorage.getItem(key);
        if (!raw) return [];
        try {
            const parsed = JSON.parse(raw);
            return Array.isArray(parsed) ? parsed : [];
        } catch (e) {
            console.error("Failed to parse storage for key", key, e);
            return [];
        }
    }

    function saveArray(key, arr) {
        localStorage.setItem(key, JSON.stringify(arr || []));
    }

    function generateId(prefix) {
        return `${prefix}_${Date.now()}_${Math.floor(Math.random() * 100000)}`;
    }

    // ----------------- Stored data helpers -----------------
function normalizeTradeDateToISO(dateStr) {
        if (!dateStr) return dateStr;
        const raw = String(dateStr).trim();

        // Already ISO YYYY-MM-DD.
        if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;

        // Legacy/local date formats such as DD-MM-YYYY or DD/MM/YYYY.
        let match = raw.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})$/);
        if (match) {
            const first = Number(match[1]);
            const second = Number(match[2]);
            const year = Number(match[3]);
            // Four-digit year is last, so interpret as day-month-year.
            const day = first;
            const month = second;
            const check = new Date(year, month - 1, day);
            if (check.getFullYear() === year && check.getMonth() === month - 1 && check.getDate() === day) {
                return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
            }
        }

        const d = new Date(raw);
        if (isNaN(d.getTime())) return raw;
        const y = d.getFullYear();
        const m = String(d.getMonth() + 1).padStart(2, "0");
        const day = String(d.getDate()).padStart(2, "0");
        return `${y}-${m}-${day}`;
    }

    function migrateTradesDatesIfNeeded(trades) {
        if (!Array.isArray(trades) || !trades.length) return trades;

        let changed = false;
        trades.forEach(t => {
            if (!t || !t.date) return;
            const normalized = normalizeTradeDateToISO(t.date);
            if (normalized && normalized !== t.date) {
                t.date = normalized;
                changed = true;
            }
        });

        if (changed) {
            try {
                setTrades(trades);
            } catch (err) {
                console.warn("Failed to persist migrated trades dates:", err);
            }
        }

        return trades;
    }

function getTrades() {
        const trades = loadArray(STORAGE_KEYS.TRADES);
        return migrateTradesDatesIfNeeded(trades);
    }

    function setTrades(trades) {
        saveArray(STORAGE_KEYS.TRADES, trades);
    }

    function getDepositsWithdrawals() {
        return loadArray(STORAGE_KEYS.DEPOSITS_WITHDRAWALS);
    }

    function setDepositsWithdrawals(list) {
        saveArray(STORAGE_KEYS.DEPOSITS_WITHDRAWALS, list);
    }

    function getSnapshots() {
        return loadArray(STORAGE_KEYS.SNAPSHOTS);
    }

    function setSnapshots(list) {
        saveArray(STORAGE_KEYS.SNAPSHOTS, list);
    }

        
function calculatePLForTrade(trade) {
    const qty = Number(trade.quantity) || 0;
    const buy = Number(trade.buyPrice) || 0;
    const sell = Number(trade.sellPrice) || 0;
    const charges = Number(trade.brokerage) || 0;

    if (!qty || !buy || !sell) return 0;

    const symbol = trade.symbol || "Custom";
    const pointValue = SYMBOL_POINT_VALUE[symbol] || 1;

    let rawPL = 0;

    if (trade.side === "Buy") {
        rawPL = (sell - buy) * qty * pointValue;
    } else if (trade.side === "Sell") {
        rawPL = (buy - sell) * qty * pointValue;
    }

    return rawPL - charges;
}

function calculateCumulativePL(trades) {
        return trades.reduce((sum, t) => sum + (Number(t.pl) || 0), 0);
    }

    function calculateTodayPL(trades) {
        const todayISO = getTodayISO();
        return trades
            .filter(t => t.date === todayISO)
            .reduce((sum, t) => sum + (Number(t.pl) || 0), 0);
    }

    
    function calculateWeeklyPL(trades) {
        if (!Array.isArray(trades) || !trades.length) return 0;

        const normalize = dateStr => {
            if (!dateStr) return null;
            const d = new Date(dateStr);
            if (isNaN(d.getTime())) return null;
            d.setHours(0, 0, 0, 0);
            return d;
        };

        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const weekday = today.getDay(); // 0 = Sunday
        const diffToMonday = (weekday + 6) % 7;
        const monday = new Date(today);
        monday.setDate(today.getDate() - diffToMonday);
        const sunday = new Date(monday);
        sunday.setDate(monday.getDate() + 6);

        return trades.reduce((sum, t) => {
            const d = normalize(t.date);
            if (!d) return sum;
            if (d >= monday && d <= sunday) {
                return sum + (Number(t.pl) || 0);
            }
            return sum;
        }, 0);
    }

    function calculateMonthlyPL(trades) {
        if (!Array.isArray(trades) || !trades.length) return 0;

        const normalize = dateStr => {
            if (!dateStr) return null;
            const d = new Date(dateStr);
            if (isNaN(d.getTime())) return null;
            d.setHours(0, 0, 0, 0);
            return d;
        };

        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const first = new Date(today.getFullYear(), today.getMonth(), 1);
        const last = new Date(today.getFullYear(), today.getMonth() + 1, 0);

        return trades.reduce((sum, t) => {
            const d = normalize(t.date);
            if (!d) return sum;
            if (d >= first && d <= last) {
                return sum + (Number(t.pl) || 0);
            }
            return sum;
        }, 0);
    }

function calculateNetDepositsWithdrawals(dwList) {
        return dwList.reduce((sum, entry) => {
            const amount = Number(entry.amount) || 0;
            if (entry.type === "Deposit") return sum + amount;
            if (entry.type === "Withdrawal") return sum - amount;
            return sum;
        }, 0);
    }

    function computeEquity(mainBalance, trades, dwList, manualAdjustment) {
        const cumulativePL = calculateCumulativePL(trades);
        const netDW = calculateNetDepositsWithdrawals(dwList);
        return mainBalance + cumulativePL + netDW + manualAdjustment;
    }

    function calculateWinRate(trades) {
        if (!trades.length) return 0;
        const winners = trades.filter(t => (Number(t.pl) || 0) > 0).length;
        return (winners / trades.length) * 100;
    }

    function calculateAveragePL(trades) {
        if (!trades.length) return 0;
        const total = trades.reduce((sum, t) => sum + (Number(t.pl) || 0), 0);
        return total / trades.length;
    }

    function filterTradesByDateRange(trades, filter) {
    if (filter === "all") return trades;

    // Safely convert stored date (YYYY-MM-DD or full ISO) to a midnight Date
    const normalize = dateStr => {
        if (!dateStr) return null;
        const d = new Date(dateStr);
        if (isNaN(d.getTime())) return null;
        d.setHours(0, 0, 0, 0);
        return d;
    };

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    if (filter === "today") {
        return trades.filter(t => {
            const d = normalize(t.date);
            return d && d.getTime() === today.getTime();
        });
    }

    if (filter === "week") {
        const weekday = today.getDay(); // 0 = Sun
        const diffToMonday = (weekday + 6) % 7;
        const monday = new Date(today);
        monday.setDate(today.getDate() - diffToMonday);
        const sunday = new Date(monday);
        sunday.setDate(monday.getDate() + 6);

        return trades.filter(t => {
            const d = normalize(t.date);
            return d && d >= monday && d <= sunday;
        });
    }

    if (filter === "month") {
        const first = new Date(today.getFullYear(), today.getMonth(), 1);
        const last = new Date(today.getFullYear(), today.getMonth() + 1, 0);

        return trades.filter(t => {
            const d = normalize(t.date);
            return d && d >= first && d <= last;
        });
    }

    return trades;
}


   function applyExtraTradeFilters(trades) {
    const symbolFilter = (tradeFilterState.symbolFilter || "").trim();
    const side = tradeFilterState.side;
    const minPL = tradeFilterState.minPL;
    const maxPL = tradeFilterState.maxPL;

    return trades.filter(t => {
        const pl = Number(t.pl) || 0;
        // Income filter (data-based)
        if (tradeFilterState.income === 'profit' && pl <= 0) return false;
        if (tradeFilterState.income === 'loss' && pl >= 0) return false;


        // Symbol dropdown filter
        if (symbolFilter) {
            if (symbolFilter === "Custom") {
                if (t.symbol !== "Custom") return false;
            } else {
                const symbolBase =
                    t.symbol === "Custom"
                        ? (t.customSymbol || "Custom")
                        : t.symbol;
                if (symbolBase !== symbolFilter) return false;
            }
        }

        if (side !== "all" && t.side !== side) return false;

        if (minPL !== null && pl < minPL) return false;
        if (maxPL !== null && pl > maxPL) return false;

        return true;
    });
}




    // ----------------- Plan Trade (R:R) helper -----------------

    
    function setupPlanTradeTool() {
        const symbolEl = document.getElementById("planSymbol");
        const sideEl = document.getElementById("planSide");
        const qtyEl = document.getElementById("planQuantity");
        const entryEl = document.getElementById("planEntry");
        const distanceEl = document.getElementById("planDistance");
        const stopEl = document.getElementById("planStop");
        const targetEl = document.getElementById("planTarget");

        const riskPerLotEl = document.getElementById("planRiskPerLot");
        const rewardPerLotEl = document.getElementById("planRewardPerLot");
        const rrEl = document.getElementById("planRR");
        const totalRiskEl = document.getElementById("planTotalRisk");
        const totalRewardEl = document.getElementById("planTotalReward");
        const summaryLabelEl = document.getElementById("planSummaryLabel");
        const clearBtn = document.getElementById("planClearBtn");

        if (
            !symbolEl ||
            !sideEl ||
            !qtyEl ||
            !entryEl ||
            !distanceEl ||
            !stopEl ||
            !targetEl ||
            !riskPerLotEl ||
            !rewardPerLotEl ||
            !rrEl ||
            !totalRiskEl ||
            !totalRewardEl
        ) {
            return;
        }

        function formatPL(value) {
            return formatCurrency(value || 0);
        }

        function reset() {
            qtyEl.value = "";
            entryEl.value = "";
            distanceEl.value = "";
            stopEl.value = "";
            targetEl.value = "";
            update();
        }

        function recalcLevelsFromDistance() {
            const entry = Number(entryEl.value);
            const dist = Number(distanceEl.value);
            if (!Number.isFinite(entry) || !Number.isFinite(dist) || dist <= 0) {
                return;
            }

            const side = sideEl.value || "Buy";
            let stop, target;

            if (side === "Buy") {
                // Buy: SL below, Target above
                stop = entry - dist;
                target = entry + dist;
            } else {
                // Sell: SL above, Target below
                stop = entry + dist;
                target = entry - dist;
            }

            stopEl.value = stop.toFixed(2);
            targetEl.value = target.toFixed(2);
        }

        function update() {
            const symbol = symbolEl.value || "Custom";
            const side = sideEl.value || "Buy";

            const qty = Number(qtyEl.value) || 0;
            const entry = Number(entryEl.value);
            const stop = Number(stopEl.value);
            const target = Number(targetEl.value);

            const pv = SYMBOL_POINT_VALUE[symbol] || 1;

            if (
                !qty ||
                !Number.isFinite(entry) ||
                !Number.isFinite(stop) ||
                !Number.isFinite(target)
            ) {
                riskPerLotEl.textContent = "₹0.00";
                rewardPerLotEl.textContent = "₹0.00";
                rrEl.textContent = "0.0";
                totalRiskEl.textContent = "₹0.00";
                totalRewardEl.textContent = "₹0.00";

                if (summaryLabelEl) {
                    summaryLabelEl.textContent =
                        "Type values to see the risk / reward profile for this idea.";
                    summaryLabelEl.classList.remove("positive", "negative");
                }
                return;
            }

            let riskPoints, rewardPoints;

            if (side === "Buy") {
                riskPoints = entry - stop;
                rewardPoints = target - entry;
            } else {
                riskPoints = stop - entry;
                rewardPoints = entry - target;
            }

            const riskPerLot = Math.max(0, riskPoints * pv);
            const rewardPerLot = Math.max(0, rewardPoints * pv);

            const totalRisk = riskPerLot * qty;
            const totalReward = rewardPerLot * qty;
            const rr = riskPerLot > 0 ? rewardPerLot / riskPerLot : 0;

            riskPerLotEl.textContent = formatPL(riskPerLot);
            rewardPerLotEl.textContent = formatPL(totalReward ? rewardPerLot : 0);
            rewardPerLotEl.textContent = formatPL(rewardPerLot);
            totalRiskEl.textContent = formatPL(totalRisk);
            totalRewardEl.textContent = formatPL(totalReward);
            rrEl.textContent = rr.toFixed(2);

            if (summaryLabelEl) {
                summaryLabelEl.classList.remove("positive", "negative");
                if (!riskPerLot || !rewardPerLot) {
                    summaryLabelEl.textContent =
                        "Check that SL/Target are on the correct side of entry.";
                } else if (rr >= 2) {
                    summaryLabelEl.textContent = `Strong R:R (~${rr.toFixed(
                        2
                    )}R).`;
                    summaryLabelEl.classList.add("positive");
                } else if (rr >= 1) {
                    summaryLabelEl.textContent = `Ok R:R (~${rr.toFixed(
                        2
                    )}R). Consider improving reward or reducing risk.`;
                } else {
                    summaryLabelEl.textContent = `Weak R:R (~${rr.toFixed(
                        2
                    )}R).`;
                    summaryLabelEl.classList.add("negative");
                }
            }
        }

        function handleEntrySideDistanceChange() {
            recalcLevelsFromDistance();
            update();
        }

        entryEl.addEventListener("input", handleEntrySideDistanceChange);
        sideEl.addEventListener("input", handleEntrySideDistanceChange);
        distanceEl.addEventListener("input", handleEntrySideDistanceChange);

        [symbolEl, qtyEl, stopEl, targetEl].forEach(el => {
            el.addEventListener("input", update);
        });

        if (clearBtn) {
            clearBtn.addEventListener("click", () => {
                reset();
            });
        }

        update();
    }

    
// ----------------- Risk Tools helper -----------------

    function setupRiskTools() {
        const symbolEl = document.getElementById("riskSymbol");
        const accountEl = document.getElementById("riskAccountSize");
        const percentEl = document.getElementById("riskPercent");
        const stopEl = document.getElementById("riskStopPoints");
        const calcBtn = document.getElementById("riskCalcBtn");
        const resultEl = document.getElementById("riskPositionSizeResult");
        const noteEl = document.getElementById("riskPositionSizeNote");

        if (
            !symbolEl ||
            !accountEl ||
            !percentEl ||
            !stopEl ||
            !calcBtn ||
            !resultEl
        ) {
            return;
        }

        // Prefill with current main balance as a starting point
        accountEl.value = loadNumber(STORAGE_KEYS.MAIN_BALANCE, 0);

        function resetOutput() {
            resultEl.textContent = "—";
            if (noteEl) noteEl.textContent = "";
        }

        function calculate() {
            const symbol = symbolEl.value || "Custom";
            const accountSize = Number(accountEl.value);
            const riskPct = Number(percentEl.value);
            const stopPoints = Number(stopEl.value);
            const pv = SYMBOL_POINT_VALUE[symbol] || 1;

            if (
                !accountSize ||
                accountSize <= 0 ||
                !riskPct ||
                riskPct <= 0 ||
                !stopPoints ||
                stopPoints <= 0
            ) {
                resetOutput();
                if (noteEl) {
                    noteEl.textContent =
                        "Fill account size, risk %, and SL distance to see position size.";
                }
                return;
            }

            const riskAmount = (accountSize * riskPct) / 100;
            const qtyFloat = riskAmount / (stopPoints * pv);
            const qty = Math.floor(qtyFloat);

            if (!qty || qty <= 0) {
                resultEl.textContent = "0";
                if (noteEl) {
                    noteEl.textContent =
                        "Risk % is too small for this SL distance / contract size.";
                }
                return;
            }

            resultEl.textContent = String(qty);

            if (noteEl) {
                const effectiveRisk = stopPoints * pv * qty;
                noteEl.textContent = `Approx risk ${formatCurrency(
                    effectiveRisk
                )} for ${qty} qty (point value ${pv}).`;
            }
        }

        calcBtn.addEventListener("click", calculate);

        [symbolEl, accountEl, percentEl, stopEl].forEach(el => {
            el.addEventListener("input", () => {
                resetOutput();
            });
        });

        resetOutput();
    }


    // ----------------- Sidebar profile avatar -----------------

    
    function setupProfileAvatar() {
        const img = document.getElementById("profileImage");
        const input = document.getElementById("profileImageInput");
        const wrapper = document.getElementById("profileAvatarWrapper");
        const nameEl = document.getElementById("profileName");

        if (!img || !input || !wrapper) return;

        // Load stored image if available
        try {
            const storedImg = localStorage.getItem(PROFILE_IMAGE_KEY);
            if (storedImg) {
                img.src = storedImg;
            }
        } catch (err) {
            console.warn("Could not load profile image from localStorage:", err);
        }

        // Load stored name if available
        if (nameEl) {
            try {
                const storedName = localStorage.getItem(PROFILE_NAME_KEY);
                if (storedName && storedName.trim()) {
                    nameEl.textContent = storedName.trim();
                }
            } catch (err) {
                console.warn("Could not load profile name from localStorage:", err);
            }

            nameEl.addEventListener("click", () => {
                const current = nameEl.textContent || "";
                const next = window.prompt("Profile name:", current);
                if (next === null) return;
                const trimmed = next.trim();
                if (!trimmed) {
                    alert("Name cannot be empty.");
                    return;
                }
                nameEl.textContent = trimmed;
                try {
                    localStorage.setItem(PROFILE_NAME_KEY, trimmed);
                } catch (err) {
                    console.warn("Could not save profile name to localStorage:", err);
                }
            });
        }

        // Clicking avatar opens file picker
        wrapper.addEventListener("click", () => {
            input.click();
        });

        input.addEventListener("change", event => {
            const file = event.target.files && event.target.files[0];
            if (!file) return;
            if (!file.type || !file.type.startsWith("image/")) {
                alert("Please select an image file.");
                return;
            }

            const reader = new FileReader();
            reader.onload = e => {
                const dataUrl = e.target.result;
                img.src = dataUrl;
                try {
                    localStorage.setItem(PROFILE_IMAGE_KEY, dataUrl);
                } catch (err) {
                    console.warn("Could not save profile image to localStorage:", err);
                }
            };
            reader.readAsDataURL(file);
        });
    }


// ----------------- Theme -----------------

    function applyThemeFromStorage() {
        const stored = localStorage.getItem(THEME_KEY) || "auto";
        const body = document.body;

        let effectiveDark = false;

        if (stored === "dark") {
            effectiveDark = true;
        } else if (stored === "light") {
            effectiveDark = false;
        } else {
            // Auto – follow system preference
            if (window.matchMedia) {
                const mq = window.matchMedia("(prefers-color-scheme: dark)");
                effectiveDark = mq.matches;
            }
        }

        if (effectiveDark) {
            body.classList.add("dark-mode");
        } else {
            body.classList.remove("dark-mode");
        }

        // Update segmented control visual state
        const lightBtn = document.getElementById("themeLightBtn");
        const darkBtn = document.getElementById("themeDarkBtn");
        const autoBtn = document.getElementById("themeAutoBtn");

        [lightBtn, darkBtn, autoBtn].forEach(btn => {
            if (btn) btn.classList.remove("active");
        });

        if (stored === "light" && lightBtn) {
            lightBtn.classList.add("active");
        } else if (stored === "dark" && darkBtn) {
            darkBtn.classList.add("active");
        } else if (autoBtn) {
            autoBtn.classList.add("active");
        }
    }

    function setupThemeToggle() {
        const lightBtn = document.getElementById("themeLightBtn");
        const darkBtn = document.getElementById("themeDarkBtn");
        const autoBtn = document.getElementById("themeAutoBtn");

        function setTheme(mode) {
            try {
                localStorage.setItem(THEME_KEY, mode);
            } catch (err) {
                console.warn("Could not persist theme:", err);
            }
            applyThemeFromStorage();
        }

        if (lightBtn) {
            lightBtn.addEventListener("click", () => setTheme("light"));
        }

        if (darkBtn) {
            darkBtn.addEventListener("click", () => setTheme("dark"));
        }

        if (autoBtn) {
            autoBtn.addEventListener("click", () => setTheme("auto"));

            // If in auto mode, listen for OS theme changes
            if (window.matchMedia) {
                const mq = window.matchMedia("(prefers-color-scheme: dark)");
                if (mq && mq.addEventListener) {
                    mq.addEventListener("change", () => {
                        const stored = localStorage.getItem(THEME_KEY) || "auto";
                        if (stored === "auto") {
                            applyThemeFromStorage();
                        }
                    });
                }
            }
        }
    }

    // ----------------- DOM updates -----------------

    function getTradesSorted() {
        return getTrades()
            .slice()
            .sort((a, b) => {
                const da = new Date(a.date);
                const db = new Date(b.date);

                // Newest date first
                if (db.getTime() !== da.getTime()) {
                    return db - da;
                }

                // Same date: latest created first
                return (b.createdAt || 0) - (a.createdAt || 0);
            });
    }

    function getTradesForCurrentFilters() {
        const sorted = getTradesSorted();
        const byDate = filterTradesByDateRange(sorted, tradeFilterState.dateRange);
        return applyExtraTradeFilters(byDate);
    }
    // Extra From / To filter for exports + table view in Trades & Reports
    function getTradesForCurrentDateInputs() {
        const fromEl = document.getElementById("tradesFromDate");
        const toEl = document.getElementById("tradesToDate");

        const from = fromEl && fromEl.value ? fromEl.value : null;
        const to = toEl && toEl.value ? toEl.value : null;

        // Start from existing filter chips + symbol/side/P&L filters
        const base = getTradesForCurrentFilters();

        if (!from && !to) return base;

        return base.filter(t => {
            if (from && t.date < from) return false;
            if (to && t.date > to) return false;
            return true;
        });
    }



    function refreshBalancesAndStats() {
        const mainBalance = loadNumber(STORAGE_KEYS.MAIN_BALANCE, 0);
        const manualAdjustment = loadNumber(STORAGE_KEYS.MANUAL_ADJUST, 0);
        const trades = getTrades();
        const dwList = getDepositsWithdrawals();

        const cumulativePL = calculateCumulativePL(trades);
        // Available balance = deposited/base capital + closed-trade P/L + net deposits/withdrawals + saved correction.
        const availableBalance = mainBalance + cumulativePL + calculateNetDepositsWithdrawals(dwList) + manualAdjustment;
        const todayPL = calculateTodayPL(trades);
        const weeklyPL = calculateWeeklyPL(trades);
        const monthlyPL = calculateMonthlyPL(trades);
        const equity = computeEquity(
            mainBalance,
            trades,
            dwList,
            manualAdjustment
        );

        const mainBalanceDisplay = document.getElementById("mainBalanceDisplay");
        const availableBalanceDisplay = document.getElementById(
            "availableBalanceDisplay"
        );
        const cumulativePLDisplay = document.getElementById("cumulativePLDisplay");
        const todayPLDisplay = document.getElementById("todayPLDisplay");
        const weeklyPLDisplay = document.getElementById("weeklyPLDisplay");
        const monthlyPLDisplay = document.getElementById("monthlyPLDisplay");
        const equityDisplay = document.getElementById("equityDisplay");
        const equityQuickLabel = document.getElementById("equityQuickLabel");

        if (mainBalanceDisplay) mainBalanceDisplay.textContent = formatCurrency(mainBalance);
        if (availableBalanceDisplay)
            availableBalanceDisplay.textContent = formatCurrency(availableBalance);
        if (cumulativePLDisplay)
            cumulativePLDisplay.textContent = formatCurrency(cumulativePL);
        if (equityDisplay) equityDisplay.textContent = formatCurrency(equity);

        if (todayPLDisplay) {
            todayPLDisplay.textContent = formatCurrency(todayPL);
            todayPLDisplay.classList.remove("positive", "negative", "neutral");
            if (todayPL > 0) todayPLDisplay.classList.add("positive");
            else if (todayPL < 0) todayPLDisplay.classList.add("negative");
            else todayPLDisplay.classList.add("neutral");
        }

        if (weeklyPLDisplay) {
            weeklyPLDisplay.textContent = formatCurrency(weeklyPL);
            weeklyPLDisplay.classList.remove("positive", "negative", "neutral");
            if (weeklyPL > 0) weeklyPLDisplay.classList.add("positive");
            else if (weeklyPL < 0) weeklyPLDisplay.classList.add("negative");
            else weeklyPLDisplay.classList.add("neutral");
        }

        if (monthlyPLDisplay) {
            monthlyPLDisplay.textContent = formatCurrency(monthlyPL);
            monthlyPLDisplay.classList.remove("positive", "negative", "neutral");
            if (monthlyPL > 0) monthlyPLDisplay.classList.add("positive");
            else if (monthlyPL < 0) monthlyPLDisplay.classList.add("negative");
            else monthlyPLDisplay.classList.add("neutral");
        }

        if (equityQuickLabel) {
            equityQuickLabel.textContent = `Equity: ${formatCurrency(equity)}`;
        }

        refreshEquityStatsAndChart();
    }

    function refreshTradesTable() {
        const tbody = document.querySelector("#tradesTable tbody");
        if (!tbody) return;

        const filtered = getTradesForCurrentDateInputs();
        tbody.innerHTML = "";

        if (!filtered.length) {
            const tr = document.createElement("tr");
            const td = document.createElement("td");
            td.colSpan = 10;
            td.textContent = "No trades match current filters.";
            td.className = "muted";
            tr.appendChild(td);
            tbody.appendChild(tr);
            return;
        }

        filtered.forEach(trade => {
            const tr = document.createElement("tr");
            const symbolDisplay =
                trade.symbol === "Custom"
                    ? trade.customSymbol || "Custom"
                    : trade.symbol;
            const pl = Number(trade.pl) || 0;
			const incomeSelect = document.getElementById("tradeFilterIncome");
const incomeMode = incomeSelect ? incomeSelect.value : "all";

if (incomeMode === "profit" && pl <= 0) return;
if (incomeMode === "loss" && pl >= 0) return;

            tr.innerHTML = `
                <td>${formatDateDisplay(trade.date)}</td>
                <td>${symbolDisplay}</td>
                <td>
  ${
    trade.side === "Buy"
      ? '<span class="badge-bullish">Buy</span>'
      : '<span class="badge-bearish">Sell</span>'
  }
</td>
                <td>${trade.quantity}</td>
                <td>${Number(trade.buyPrice) || 0}</td>
                <td>${Number(trade.sellPrice) || 0}</td>
                <td>${Number(trade.brokerage) || 0}</td>
                <td class="${pl > 0 ? "pl-positive" : pl < 0 ? "pl-negative" : ""}">
                    ${formatCurrency(pl)}
                </td>
                <td>${trade.notes ? trade.notes : ""}</td>
                <td>
                    <div class="table-actions">
                        <button class="btn btn-danger btn-xs"
                                data-action="delete-trade"
                                data-id="${trade.id}">🗑️</button>
                    </div>
                </td>
            `;

            tbody.appendChild(tr);
        });
    }

       function refreshDWTable() {
        const tbody = document.querySelector("#dwTable tbody");
        if (!tbody) return;

        const list = getFilteredDWList();


        tbody.innerHTML = "";

        if (!list.length) {
            const tr = document.createElement("tr");
            const td = document.createElement("td");
            td.colSpan = 5;
            td.textContent = "No deposits/withdrawals logged.";
            td.className = "muted";
            tr.appendChild(td);
            tbody.appendChild(tr);
            return;
        }

        list.forEach(entry => {
            const tr = document.createElement("tr");
            tr.innerHTML = `
                <td>${formatDateDisplay(entry.date)}</td>
                <td>${entry.type}</td>
                <td>${formatCurrency(entry.amount)}</td>
                <td>${entry.note || ""}</td>
                <td>
                    <button class="btn btn-danger btn-xs"
                            data-action="delete-dw"
                            data-id="${entry.id}">🗑️</button>
                </td>
            `;
            tbody.appendChild(tr);
        });
    }
	
	
	    function getFilteredDWList() {
        const fromInput = document.getElementById("dwFromDate");
        const toInput = document.getElementById("dwToDate");

        const from = fromInput && fromInput.value ? fromInput.value : null;
        const to = toInput && toInput.value ? toInput.value : null;

        return getDepositsWithdrawals()
            .slice()
            .sort((a, b) => a.date.localeCompare(b.date))
            .filter(entry => {
                if (from && entry.date < from) return false;
                if (to && entry.date > to) return false;
                return true;
            });
    }

	
	

    
    // Extra From / To filter for Market Snapshot table + exports
    function getSnapshotsForCurrentDateInputs() {
        const fromEl = document.getElementById("snapshotFromDate");
        const toEl = document.getElementById("snapshotToDate");

        const from = fromEl && fromEl.value ? fromEl.value : null;
        const to = toEl && toEl.value ? toEl.value : null;

        const list = getSnapshots()
            .slice()
            .sort((a, b) => {
                if (a.date === b.date) {
                    return (a.createdAt || 0) - (b.createdAt || 0);
                }
                return a.date.localeCompare(b.date);
            });

        if (!from && !to) return list;

        return list.filter(snap => {
            if (from && snap.date < from) return false;
            if (to && snap.date > to) return false;
            return true;
        });
    }



    function getSnapshotSummaryRows() {
        const snapshots = getSnapshotsForCurrentDateInputs();
        if (!snapshots.length) return [];

        const groups = new Map();

        snapshots.forEach(snap => {
            let symbolDisplay = "";
            if (snap.symbolType) {
                if (snap.symbolType === "Custom") {
                    symbolDisplay = snap.customSymbol || "Custom";
                } else {
                    symbolDisplay = snap.symbolType;
                }
            } else {
                symbolDisplay = snap.symbol || "";
            }
            const key = snap.date + "||" + symbolDisplay;
            if (!groups.has(key)) {
                groups.set(key, []);
            }
            groups.get(key).push(snap);
        });

        const rows = [];

        groups.forEach((list, key) => {
            if (!list.length) return;

            list.sort((a, b) => {
                const da = a.createdAt || 0;
                const db = b.createdAt || 0;
                return da - db;
            });

            const parts = key.split("||");
            const date = parts[0];
            const symbolDisplay = parts[1];

            const firstSnap = list[0];
            const lastSnap = list[list.length - 1];
            const dayOpen = Number(firstSnap.open);
            const dayClose = Number(lastSnap.close);

            let dayTrend = "";
            if (Number.isFinite(dayOpen) && Number.isFinite(dayClose)) {
                if (dayClose > dayOpen) dayTrend = "Buy";
                else if (dayClose < dayOpen) dayTrend = "Sell";
                else dayTrend = "Sideways";
            }

            function summarizeHalf(sessionKey, labelPrefix) {
                const halfSnaps = list.filter(s => s.session === sessionKey);
                if (!halfSnaps.length) return "";

                halfSnaps.sort((a, b) => {
                    const da = a.createdAt || 0;
                    const db = b.createdAt || 0;
                    return da - db;
                });

                const first = halfSnaps[0];
                const last = halfSnaps[halfSnaps.length - 1];
                const openVal = Number(first.open);
                const closeVal = Number(last.close);
                if (!Number.isFinite(openVal) || !Number.isFinite(closeVal)) return "";

                let trend = first.trend || "";
                if (!trend) {
                    if (closeVal > openVal) trend = "Buy";
                    else if (closeVal < openVal) trend = "Sell";
                    else trend = "Sideways";
                }
                return labelPrefix + " O " + openVal + " → C " + closeVal + " (" + trend + ")";
            }

            const firstHalfSummary = summarizeHalf("first", "1st:");
            const secondHalfSummary = summarizeHalf("second", "2nd:");

            rows.push({
                date,
                symbolDisplay,
                dayOpen: Number.isFinite(dayOpen) ? dayOpen : null,
                dayClose: Number.isFinite(dayClose) ? dayClose : null,
                firstHalfSummary,
                secondHalfSummary,
                dayTrend
            });
        });

        rows.sort((a, b) => {
            if (a.date === b.date) {
                return a.symbolDisplay.localeCompare(b.symbolDisplay);
            }
            return a.date.localeCompare(b.date);
        });

        return rows;
    }

    function refreshSnapshotSummaryTable() {
        const tbody = document.querySelector("#snapshotSummaryTable tbody");
        if (!tbody) return;

        const rows = getSnapshotSummaryRows();

        tbody.innerHTML = "";

        if (!rows.length) {
            const tr = document.createElement("tr");
            const td = document.createElement("td");
            td.colSpan = 6;
            td.textContent = "No summary rows for current filters.";
            td.className = "muted";
            tr.appendChild(td);
            tbody.appendChild(tr);
            return;
        }

        rows.forEach(row => {
            const tr = document.createElement("tr");
            const ocText =
                row.dayOpen != null && row.dayClose != null
                    ? row.dayOpen + " → " + row.dayClose
                    : "—";

            tr.innerHTML = `
                <td>${formatDateDisplay(row.date)}</td>
                <td>${row.symbolDisplay}</td>
                <td>${ocText}</td>
                <td>${row.firstHalfSummary || "—"}</td>
                <td>${row.secondHalfSummary || "—"}</td>
                <td>${row.dayTrend || ""}</td>
            `;
            tbody.appendChild(tr);
        });
    }

function refreshSnapshotTable() {
        const tbody = document.querySelector("#snapshotTable tbody");
        if (!tbody) return;

        const snapshots = getSnapshotsForCurrentDateInputs();

        tbody.innerHTML = "";

        if (!snapshots.length) {
            const tr = document.createElement("tr");
            const td = document.createElement("td");
            td.colSpan = 7;
            td.textContent = "No snapshots match current filters.";
            td.className = "muted";
            tr.appendChild(td);
            tbody.appendChild(tr);
            return;
        }

        snapshots.forEach(snap => {
            let symbolDisplay = "";
            if (snap.symbolType) {
                if (snap.symbolType === "Custom") {
                    symbolDisplay = snap.customSymbol || "Custom";
                } else {
                    symbolDisplay = snap.symbolType;
                }
            } else {
                symbolDisplay = snap.symbol || "";
            }

            const tr = document.createElement("tr");
            tr.innerHTML = `
                <td>${formatDateDisplay(snap.date)}</td>
                <td>${symbolDisplay}</td>
                <td>${snap.session === "first" ? "1st half" : snap.session === "second" ? "2nd half" : "Full day"}</td>
                <td>${Number(snap.open)}</td>
                <td>${Number(snap.close)}</td>
                <td>${snap.trend}</td>
                <td>
                    <button class="btn btn-danger btn-xs"
                            data-action="delete-snapshot"
                            data-id="${snap.id}">🗑️</button>
                </td>
            `;
            tbody.appendChild(tr);
        });
    }

    function refreshEquityStatsAndChart() {
        const trades = getTradesSorted();
        const dwList = getDepositsWithdrawals()
            .slice()
            .sort((a, b) => a.date.localeCompare(b.date));
        const mainBalance = loadNumber(STORAGE_KEYS.MAIN_BALANCE, 0);
        const manualAdjustment = loadNumber(STORAGE_KEYS.MANUAL_ADJUST, 0);

        const winRate = calculateWinRate(trades);
        const avgPL = calculateAveragePL(trades);

        const winRateDisplay = document.getElementById("winRateDisplay");
        const avgPLDisplay = document.getElementById("avgPLDisplay");
        const tradeCountDisplay = document.getElementById("tradeCountDisplay");

        if (winRateDisplay) winRateDisplay.textContent = `${winRate.toFixed(1)}%`;
        if (avgPLDisplay) avgPLDisplay.textContent = formatCurrency(avgPL);
        if (tradeCountDisplay) tradeCountDisplay.textContent = String(trades.length);

        const equityLabels = [];
        const equityData = [];
        let cumulativePL = 0;
        let cumulativeDW = 0;

        const events = [];

        trades.forEach(t => {
            events.push({
                type: "trade",
                date: t.date,
                createdAt: t.createdAt || 0,
                pl: Number(t.pl) || 0
            });
        });

        dwList.forEach(d => {
            const amount = Number(d.amount) || 0;
            const signed = d.type === "Deposit" ? amount : -amount;
            events.push({
                type: "dw",
                date: d.date,
                createdAt: d.createdAt || 0,
                amount: signed
            });
        });

        events.sort((a, b) => {
            if (a.date === b.date) {
                return (a.createdAt || 0) - (b.createdAt || 0);
            }
            return a.date.localeCompare(b.date);
        });

        events.forEach(evt => {
            if (evt.type === "trade") {
                cumulativePL += evt.pl;
            } else if (evt.type === "dw") {
                cumulativeDW += evt.amount;
            }
            const equity =
                mainBalance + cumulativePL + cumulativeDW + manualAdjustment;
            equityLabels.push(formatDateDisplay(evt.date));
            equityData.push(equity);
        });

        if (!events.length) {
            equityLabels.push(formatDateDisplay(getTodayISO()));
            const baseline = computeEquity(mainBalance, [], dwList, manualAdjustment);
            equityData.push(baseline);
        }

        const ctx = document.getElementById("equityChart");
        if (!ctx) return;

        if (equityChartInstance) {
            equityChartInstance.destroy();
        }

        equityChartInstance = new Chart(ctx, {
            type: "line",
            data: {
                labels: equityLabels,
                datasets: [
                    {
                        label: "Equity",
                        data: equityData,
                        tension: 0.35,
                        fill: false
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { display: false },
                    tooltip: { intersect: false, mode: "index" }
                },
                scales: {
                    x: {
                        ticks: {
                            font: { size: 9 }
                        }
                    },
                    y: {
                        ticks: {
                            font: { size: 9 }
                        }
                    }
                }
            }
        });
    }

    // ----------------- CSV / PDF helpers -----------------

    function createCSVContent(headers, rows) {
        const escapeCell = value => {
            if (value === null || value === undefined) return "";
            const str = String(value);
            if (str.includes(",") || str.includes('"') || str.includes("\n")) {
                return `"${str.replace(/"/g, '""')}"`;
            }
            return str;
        };

        const headerLine = headers.map(escapeCell).join(",");
        const rowLines = rows.map(row => row.map(escapeCell).join(","));
        return [headerLine, ...rowLines].join("\n");
    }

    function downloadCSV(filename, csvContent) {
        const blob = new Blob([csvContent], {
            type: "text/csv;charset=utf-8;"
        });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }

    function openPrintWindowWithHTML(title, tableHTML) {
        const win = window.open("", "_blank");
        if (!win) {
            alert("Popup blocked. Please allow popups for PDF export.");
            return;
        }
        win.document.write(`
            <!DOCTYPE html>
            <html>
            <head>
                <meta charset="UTF-8">
                <title>${title}</title>
                <style>
                    body {
                        font-family: system-ui, sans-serif;
                        padding: 16px;
                    }
                    h1 {
                        font-size: 18px;
                        margin-bottom: 12px;
                    }
                    table {
                        width: 100%;
                        border-collapse: collapse;
                        font-size: 12px;
                    }
                    th, td {
                        padding: 6px 4px;
                        border: 1px solid #94a3b8;
                        text-align: left;
                    }
                    th {
                        background: #e5e7eb;
                    }
                </style>
            </head>
            <body>
                <h1>${title}</h1>
                ${tableHTML}
            </body>
            </html>
        `);
        win.document.close();
        win.focus();
        win.print();
    }

    // ----------------- Balance buttons -----------------

    function setupBalanceButtons() {
        const editMainBtn = document.getElementById("editMainBalanceBtn");
        const editAvailBtn = document.getElementById("editAvailableBalanceBtn");

        if (editMainBtn) {
            editMainBtn.addEventListener("click", () => {
                openPasswordModal("edit main balance", () => {
                    const current = loadNumber(STORAGE_KEYS.MAIN_BALANCE, 0);
                    openBalanceEditModal({
                        titleText: "Main Balance",
                        subtitleText: "Enter new main balance.",
                        labelText: "New main balance",
                        currentValue: current,
                        allowNegative: false,
                        promptText: "Enter new main balance:",
                        onSave(value) {
                            saveNumber(STORAGE_KEYS.MAIN_BALANCE, value);
                            refreshBalancesAndStats();
                            showToast("Main balance updated", "success");
                        }
                    });
                });
            });
        }

        if (editAvailBtn) {
            editAvailBtn.addEventListener("click", () => {
                openPasswordModal("edit available balance", () => {
                    const current = loadNumber(STORAGE_KEYS.AVAILABLE_BALANCE, 0);
                    openBalanceEditModal({
                        titleText: "Available Balance",
                        subtitleText: "Enter new available balance.",
                        labelText: "New available balance",
                        currentValue: current,
                        allowNegative: false,
                        promptText: "Enter new available balance:",
                        onSave(value) {
                            const base = loadNumber(STORAGE_KEYS.MAIN_BALANCE, 0)
                                + calculateCumulativePL(getTrades())
                                + calculateNetDepositsWithdrawals(getDepositsWithdrawals());
                            saveNumber(STORAGE_KEYS.MANUAL_ADJUST, value - base);
                            saveNumber(STORAGE_KEYS.AVAILABLE_BALANCE, value);
                            refreshBalancesAndStats();
                            showToast("Available balance correction saved", "success");
                        }
                    });
                });
            });
        }


    }

    // ----------------- Trades & filters -----------------

    function setupTradeForm() {
        const form = document.getElementById("tradeForm");
        const dateInput = document.getElementById("tradeDate");
        const symbolSelect = document.getElementById("tradeSymbol");
        const customSymbolRow = document.getElementById("customSymbolRow");
        const customSymbolInput = document.getElementById("customSymbol");
        const quantityInput = document.getElementById("tradeQuantity");
        const buyPriceInput = document.getElementById("buyPrice");
        const sellPriceInput = document.getElementById("sellPrice");
        const brokerageInput = document.getElementById("brokerage");
        const previewPLSpan = document.getElementById("previewPL");
        const previewPLBtn = document.getElementById("previewPLBtn");

        if (dateInput) dateInput.value = getTodayISO();

        if (symbolSelect && customSymbolRow && customSymbolInput) {
            symbolSelect.addEventListener("change", () => {
                if (symbolSelect.value === "Custom") {
                    customSymbolRow.style.display = "";
                } else {
                    customSymbolRow.style.display = "none";
                    customSymbolInput.value = "";
                }
            });
        }

        function resetPreviewPL() {
            if (!previewPLSpan) return;
            previewPLSpan.textContent = "P/L: ₹0.00";
            previewPLSpan.classList.remove("positive", "negative");
            previewPLSpan.classList.add("neutral");
        }

                function updatePreviewPL() {
            if (!previewPLSpan) return;
            const qty = Number(quantityInput.value) || 0;
            const buy = Number(buyPriceInput.value);
            const sell = Number(sellPriceInput.value);
            const charges = Number(brokerageInput.value) || 0;

            if (!qty || isNaN(buy) || isNaN(sell)) {
                resetPreviewPL();
                return;
            }

            const sideEl = document.getElementById("tradeSide");
            const side = sideEl ? sideEl.value : "Buy";
            const symbol = symbolSelect ? symbolSelect.value : "Custom";

            const tempTrade = {
                quantity: qty,
                buyPrice: buy,
                sellPrice: sell,
                brokerage: charges,
                side: side,
                symbol: symbol
            };

            const pl = calculatePLForTrade(tempTrade);

            previewPLSpan.textContent = `P/L: ${formatCurrency(pl)}`;
            previewPLSpan.classList.remove("positive", "negative", "neutral");
            if (pl > 0) previewPLSpan.classList.add("positive");
            else if (pl < 0) previewPLSpan.classList.add("negative");
            else previewPLSpan.classList.add("neutral");
        }
if (previewPLBtn) {
            previewPLBtn.addEventListener("click", updatePreviewPL);
        }

        if (quantityInput && buyPriceInput && sellPriceInput && brokerageInput) {
            [quantityInput, buyPriceInput, sellPriceInput, brokerageInput].forEach(
                input => {
                    input.addEventListener("input", resetPreviewPL);
                }
            );
        }

        if (form) {
            form.addEventListener("submit", event => {
                event.preventDefault();

                const trades = getTrades();

                const date = dateInput.value;
                const symbol = symbolSelect.value;
                const customSymbol = customSymbolInput.value.trim();
                const side = document.getElementById("tradeSide").value;
                const quantity = Number(quantityInput.value);
                const buyPrice = buyPriceInput.value;
                const sellPrice = sellPriceInput.value;
                const brokerage = brokerageInput.value || "0";
                const notes = document
                    .getElementById("tradeNotes")
                    .value.trim();

                if (!date) {
                    alert("Trade date is required.");
                    return;
                }

                if (!quantity || quantity <= 0) {
                    alert("Quantity must be greater than zero.");
                    return;
                }

                if (!buyPrice || !sellPrice) {
                    alert(
                        "Both Buy Price and Sell Price must be filled to save trade."
                    );
                    return;
                }

                const buyNum = Number(buyPrice);
                const sellNum = Number(sellPrice);
                if (Number.isNaN(buyNum) || Number.isNaN(sellNum)) {
                    alert("Buy and Sell prices must be valid numbers.");
                    return;
                }

                const trade = {
                    id: generateId("trade"),
                    date,
                    symbol,
                    customSymbol,
                    side,
                    quantity,
                    buyPrice: buyNum,
                    sellPrice: sellNum,
                    brokerage: Number(brokerage) || 0,
                    notes,
                    createdAt: Date.now()
                };

                trade.pl = calculatePLForTrade(trade);

                trades.push(trade);
                setTrades(trades);

                // Trade P/L is included in the calculated Available Balance.
                // Do not change the deposited/base amount here.

                form.reset();
                if (dateInput) dateInput.value = date;
                if (symbolSelect) symbolSelect.value = "Gold";
                if (customSymbolRow) customSymbolRow.style.display = "none";
                resetPreviewPL();

                refreshTradesTable();
                refreshBalancesAndStats();
                showToast("Trade saved & balances updated", "success");
                if (window.refreshTradeCalendar) window.refreshTradeCalendar();
            });
        }

        const tradesTable = document.getElementById("tradesTable");
        if (tradesTable) {
            tradesTable.addEventListener("click", event => {
                const target = event.target;
                if (!(target instanceof HTMLElement)) return;
                const action = target.getAttribute("data-action");
                if (action === "delete-trade") {
                    const id = target.getAttribute("data-id");
                    if (!id) return;

                    openPasswordModal("delete trade", () => {
                        const trades = getTrades();
                        const trade = trades.find(t => t.id === id);
                        const updated = trades.filter(t => t.id !== id);
                        setTrades(updated);

                        // Removing the trade recalculates Available Balance;
                        // deposited/base amount remains unchanged.

                        refreshTradesTable();
                        refreshBalancesAndStats();
                        showToast("Trade deleted", "danger");
                        if (window.refreshTradeCalendar) window.refreshTradeCalendar();
                    });
                }
            });
        }

        const filterGroup = document.getElementById("tradeFilterGroup");
        if (filterGroup) {
            filterGroup.addEventListener("click", event => {
                const target = event.target;
                if (!(target instanceof HTMLElement)) return;
                if (!target.classList.contains("filter-chip")) return;
                const filter = target.getAttribute("data-filter");
                if (!filter) return;

                tradeFilterState.dateRange = filter;

                filterGroup.querySelectorAll(".filter-chip").forEach(chip => {
                    chip.classList.remove("active");
                });
                target.classList.add("active");

                refreshTradesTable();
            });
        }

        const symbolFilterSelect = document.getElementById("tradeFilterSymbol");
const sideFilterSelect = document.getElementById("tradeFilterSide");
const incomeFilterSelect = document.getElementById("tradeFilterIncome");
const minPLInput = document.getElementById("tradeFilterMinPL");
const maxPLInput = document.getElementById("tradeFilterMaxPL");
const clearBtn = document.getElementById("tradeFilterClearBtn");

if (symbolFilterSelect) {
    symbolFilterSelect.addEventListener("change", () => {
        tradeFilterState.symbolFilter = symbolFilterSelect.value || "";
        refreshTradesTable();
    });
}

if (sideFilterSelect) {
    sideFilterSelect.addEventListener("change", () => {
        tradeFilterState.side = sideFilterSelect.value || "all";
        refreshTradesTable();
    });
}

if (incomeFilterSelect) {
  incomeFilterSelect.addEventListener("change", () => {
    tradeFilterState.income = incomeFilterSelect.value || "all";
    refreshTradesTable();
  });
}


if (clearBtn) {
    clearBtn.addEventListener("click", () => {
        // Reset filter state
        tradeFilterState.symbolFilter = "";
        tradeFilterState.side = "all";
        tradeFilterState.minPL = null;
        tradeFilterState.maxPL = null;

        // Reset UI controls
        if (symbolFilterSelect) symbolFilterSelect.value = "";
        if (sideFilterSelect) sideFilterSelect.value = "all";
        if (minPLInput) minPLInput.value = "";
        if (maxPLInput) maxPLInput.value = "";

        refreshTradesTable();
    });
}


        function parsePLInput(value) {
            if (value === "" || value === null || value === undefined) return null;
            const num = Number(value);
            if (Number.isNaN(num)) return null;
            return num;
        }

        if (minPLInput) {
            minPLInput.addEventListener("input", () => {
                tradeFilterState.minPL = parsePLInput(minPLInput.value);
                refreshTradesTable();
            });
        }

        if (maxPLInput) {
            maxPLInput.addEventListener("input", () => {
                tradeFilterState.maxPL = parsePLInput(maxPLInput.value);
                refreshTradesTable();
            });
        }

       if (clearBtn) {
    clearBtn.addEventListener("click", () => {
        tradeFilterState.symbolFilter = "";
        tradeFilterState.side = "all";
        tradeFilterState.minPL = null;
        tradeFilterState.maxPL = null;

        if (symbolFilterSelect) symbolFilterSelect.value = "";
        if (sideFilterSelect) sideFilterSelect.value = "all";
        if (minPLInput) minPLInput.value = "";
        if (maxPLInput) maxPLInput.value = "";

        refreshTradesTable();
    });
}

    }

    // ----------------- Deposits / Withdrawals -----------------

   // ----------------- Deposits / Withdrawals -----------------

function setupDWModule() {
    const form = document.getElementById("dwForm");
    const dateInput = document.getElementById("dwDate");
    const typeSelect = document.getElementById("dwType");
    const amountInput = document.getElementById("dwAmount");
    const noteInput = document.getElementById("dwNote");

    const exportPDFBtn = document.getElementById("exportDW_PDF");
    const exportCSVBtn = document.getElementById("exportDW_CSV");

    const fromDateInput = document.getElementById("dwFromDate");
    const toDateInput = document.getElementById("dwToDate");

    if (dateInput) dateInput.value = getTodayISO();

    // 🔄 When from/to dates change, refresh the DW table
    if (fromDateInput) {
        fromDateInput.addEventListener("change", () => {
            refreshDWTable();
        });
    }
    if (toDateInput) {
        toDateInput.addEventListener("change", () => {
            refreshDWTable();
        });
    }

    // ✅ Save new DW entry
    if (form) {
        form.addEventListener("submit", event => {
            event.preventDefault();

            const date = dateInput.value;
            const type = typeSelect.value;
            const amount = Number(amountInput.value);
            const note = noteInput.value.trim();

            if (!date) {
                alert("Date is required.");
                return;
            }
            if (!amount || amount <= 0) {
                alert("Amount must be greater than zero.");
                return;
            }

            const list = getDepositsWithdrawals();
            const entry = {
                id: generateId("dw"),
                date,
                type,
                amount,
                note,
                createdAt: Date.now()
            };
            list.push(entry);
            setDepositsWithdrawals(list);

            // Deposited/base amount stays constant. Deposits and withdrawals
            // affect Available Balance through refreshBalancesAndStats() only.

            form.reset();
            if (dateInput) dateInput.value = date;
            if (typeSelect) typeSelect.value = "Deposit";

            refreshDWTable();
            refreshBalancesAndStats();
            if (window.refreshTradeCalendar) window.refreshTradeCalendar();
            showToast("Deposit / Withdrawal saved", "success");
        });
    }

    // ✅ Delete entry
    const dwTable = document.getElementById("dwTable");
    if (dwTable) {
        dwTable.addEventListener("click", event => {
            const target = event.target;
            if (!(target instanceof HTMLElement)) return;
            const action = target.getAttribute("data-action");
            if (action === "delete-dw") {
                const id = target.getAttribute("data-id");
                if (!id) return;

                openPasswordModal("delete deposit/withdrawal entry", () => {
                    const list = getDepositsWithdrawals();
                    const entry = list.find(e => e.id === id);
                    const updated = list.filter(e => e.id !== id);
                    setDepositsWithdrawals(updated);

                    // Removing a deposit/withdrawal changes the calculated
                    // Available Balance, never the deposited/base amount.

                    refreshDWTable();
                    refreshBalancesAndStats();
                    if (window.refreshTradeCalendar) window.refreshTradeCalendar();
                    showToast("Entry deleted", "danger");
                });
            }
        });
    }

    // ✅ Export CSV (respects From / To)
    if (exportCSVBtn) {
        exportCSVBtn.addEventListener("click", () => {
            const list = getFilteredDWList();   // uses dwFromDate + dwToDate
            if (!list.length) {
                alert("No deposits/withdrawals in selected range to export.");
                return;
            }

            const headers = ["Date", "Type", "Amount", "Note"];
            const rows = list.map(entry => [
                formatDateDisplay(entry.date),
                entry.type,
                entry.amount,
                entry.note || ""
            ]);

            const csv = createCSVContent(headers, rows);
            const stamp = getTodayISO().replace(/-/g, "");
            downloadCSV(`deposits_withdrawals_${stamp}.csv`, csv);
        });
    }

    // ✅ Export PDF (respects From / To)
    if (exportPDFBtn) {
        exportPDFBtn.addEventListener("click", () => {
            const list = getFilteredDWList();   // uses dwFromDate + dwToDate
            if (!list.length) {
                alert("No deposits/withdrawals in selected range to export.");
                return;
            }

            let tableHTML = `
                <table>
                    <thead>
                        <tr>
                            <th>Date</th>
                            <th>Type</th>
                            <th>Amount</th>
                            <th>Note</th>
                        </tr>
                    </thead>
                    <tbody>
            `;

            list.forEach(entry => {
                tableHTML += `
                    <tr>
                        <td>${formatDateDisplay(entry.date)}</td>
                        <td>${entry.type}</td>
                        <td>${formatCurrency(entry.amount)}</td>
                        <td>${entry.note || ""}</td>
                    </tr>
                `;
            });

            tableHTML += "</tbody></table>";
            openPrintWindowWithHTML("Deposits / Withdrawals (Filtered)", tableHTML);
        });
    }
}
// ----------------- Market Snapshots -----------------



    function setupSnapshotModule() {
        const form = document.getElementById("snapshotForm");
        const dateInput = document.getElementById("snapshotDate");
        const symbolTypeSelect = document.getElementById("snapshotSymbolType");
        const symbolCustomInput = document.getElementById("snapshotSymbolCustom");
        const customRow = document.getElementById("snapshotCustomSymbolRow");
        const sessionSelect = document.getElementById("snapshotSession");
        const openInput = document.getElementById("snapshotOpen");
        const closeInput = document.getElementById("snapshotClose");
        const trendDisplay = document.getElementById("snapshotTrendDisplay");
        const exportCSVBtn = document.getElementById("snapshotExportCSV");
        const exportPDFBtn = document.getElementById("snapshotExportPDF");
        const fromDateInput = document.getElementById("snapshotFromDate");
        const toDateInput = document.getElementById("snapshotToDate");
        const entriesWrapper = document.getElementById("snapshotEntriesWrapper");
        const summaryWrapper = document.getElementById("snapshotSummaryWrapper");
        const viewEntriesBtn = document.getElementById("snapshotViewEntriesBtn");
        const viewSummaryBtn = document.getElementById("snapshotViewSummaryBtn");
        const exportSummaryCSVBtn = document.getElementById("snapshotSummaryExportCSV");
        const exportSummaryPDFBtn = document.getElementById("snapshotSummaryExportPDF");

        if (dateInput) dateInput.value = getTodayISO();

        if (sessionSelect) sessionSelect.value = "full";

        function setSnapshotView(mode) {
            const showSummary = mode === "summary";
            if (entriesWrapper) {
                entriesWrapper.style.display = showSummary ? "none" : "";
            }
            if (summaryWrapper) {
                summaryWrapper.style.display = showSummary ? "" : "none";
            }
            if (viewEntriesBtn) {
                viewEntriesBtn.classList.toggle("btn-primary", !showSummary);
                viewEntriesBtn.classList.toggle("btn-outline", showSummary);
            }
            if (viewSummaryBtn) {
                viewSummaryBtn.classList.toggle("btn-primary", showSummary);
                viewSummaryBtn.classList.toggle("btn-outline", !showSummary);
            }
        }

        if (viewEntriesBtn) {
            viewEntriesBtn.addEventListener("click", () => {
                setSnapshotView("entries");
            });
        }

        if (viewSummaryBtn) {
            viewSummaryBtn.addEventListener("click", () => {
                setSnapshotView("summary");
            });
        }

        // default view
        setSnapshotView("entries");

        function autoSetTrendFromPrices() {
            if (!openInput || !closeInput || !trendDisplay) return;
            const openVal = Number(openInput.value);
            const closeVal = Number(closeInput.value);
            if (Number.isNaN(openVal) || Number.isNaN(closeVal)) return;

            let trend;
            if (closeVal > openVal) {
                trend = "Buy";
            } else if (closeVal < openVal) {
                trend = "Sell";
            } else {
                trend = "Sideways";
            }

            // Update badge text & color
            trendDisplay.textContent = trend;
            trendDisplay.classList.remove("trend-buy", "trend-sell", "trend-sideways");
            if (trend === "Buy") {
                trendDisplay.classList.add("trend-buy");
            } else if (trend === "Sell") {
                trendDisplay.classList.add("trend-sell");
            } else {
                trendDisplay.classList.add("trend-sideways");
            }
        }

        if (openInput) {
            openInput.addEventListener("input", autoSetTrendFromPrices);
        }
        if (closeInput) {
            closeInput.addEventListener("input", autoSetTrendFromPrices);
        }

        if (symbolTypeSelect && customRow && symbolCustomInput) {
            symbolTypeSelect.addEventListener("change", () => {
                if (symbolTypeSelect.value === "Custom") {
                    customRow.style.display = "";
                } else {
                    customRow.style.display = "none";
                    symbolCustomInput.value = "";
                }
            });
        }

        function applySnapshotDateFilter(list) {
            const from =
                fromDateInput && fromDateInput.value ? fromDateInput.value : null;
            const to =
                toDateInput && toDateInput.value ? toDateInput.value : null;

            return list.filter(snap => {
                if (from && snap.date < from) return false;
                if (to && snap.date > to) return false;
                return true;
            });
        }

        if (form) {
            form.addEventListener("submit", event => {
                event.preventDefault();

                const date = dateInput.value;
                const symbolType = symbolTypeSelect.value;
                const customSymbol = symbolCustomInput.value.trim();
                const open = Number(openInput.value);
                const close = Number(closeInput.value);

                let trend;
                if (close > open) {
                    trend = "Buy";
                } else if (close < open) {
                    trend = "Sell";
                } else {
                    trend = "Sideways";
                }

                if (!date || !symbolType || Number.isNaN(open) || Number.isNaN(close) || !trend) {
                    alert("All snapshot fields must be filled.");
                    return;
                }

                if (symbolType === "Custom" && !customSymbol) {
                    alert("Please enter a custom symbol.");
                    return;
                }

                const effectiveSymbol =
                    symbolType === "Custom" ? customSymbol : symbolType;

                const snapshots = getSnapshots();
                const snap = {
                    id: generateId("snap"),
                    date,
                    symbolType,
                    customSymbol,
                    symbol: effectiveSymbol,
                    session: (sessionSelect && sessionSelect.value) || "full",
                    open,
                    close,
                    trend,
                    createdAt: Date.now()
                };
                snapshots.push(snap);
                setSnapshots(snapshots);

                form.reset();
                if (dateInput) dateInput.value = date;
                if (symbolTypeSelect) symbolTypeSelect.value = "Gold";
                if (sessionSelect) sessionSelect.value = "full";
                if (customRow) customRow.style.display = "none";
                if (trendDisplay) {
                    trendDisplay.textContent = "Sideways";
                    trendDisplay.classList.remove("trend-buy", "trend-sell", "trend-sideways");
                    trendDisplay.classList.add("trend-sideways");
                }

                refreshSnapshotTable();
                refreshSnapshotSummaryTable();
                showToast("Snapshot saved", "success");
                document.dispatchEvent(new CustomEvent("snapshotSaved"));
                if (window.refreshTradeCalendar) window.refreshTradeCalendar();
            });
        }

        const snapshotTable = document.getElementById("snapshotTable");
        if (snapshotTable) {
            snapshotTable.addEventListener("click", event => {
                const target = event.target;
                if (!(target instanceof HTMLElement)) return;
                const action = target.getAttribute("data-action");
                if (action === "delete-snapshot") {
                    const id = target.getAttribute("data-id");
                    if (!id) return;
                    openPasswordModal("delete snapshot", () => {
                        const snapshots = getSnapshots();
                        const updated = snapshots.filter(s => s.id !== id);
                        setSnapshots(updated);
                        refreshSnapshotTable();
                        refreshSnapshotSummaryTable();
                        showToast("Snapshot deleted", "danger");
                        if (window.refreshTradeCalendar) window.refreshTradeCalendar();
                    });
                }
            });
        }

        if (exportCSVBtn) {
            exportCSVBtn.addEventListener("click", () => {
                const snapshots = getSnapshots()
                    .slice()
                    .sort((a, b) => a.date.localeCompare(b.date));
                const filtered = applySnapshotDateFilter(snapshots);

                if (!filtered.length) {
                    alert("No snapshots in selected range to export.");
                    return;
                }

                const headers = ["Date", "Symbol", "Session", "Open", "Close", "Trend"];
                const rows = filtered.map(s => {
                    let symbolDisplay = "";
                    if (s.symbolType) {
                        if (s.symbolType === "Custom") {
                            symbolDisplay = s.customSymbol || "Custom";
                        } else {
                            symbolDisplay = s.symbolType;
                        }
                    } else {
                        symbolDisplay = s.symbol || "";
                    }

                    return [
                        formatDateDisplay(s.date),
                        symbolDisplay,
                        s.session === "first"
                            ? "1st half"
                            : s.session === "second"
                            ? "2nd half"
                            : "Full day",
                        s.open,
                        s.close,
                        s.trend
                    ];
                });

                const csv = createCSVContent(headers, rows);
                const filename = `snapshots_${getTodayISO().replace(/-/g, "")}.csv`;
                downloadCSV(filename, csv);
            });
        }

        if (exportPDFBtn) {
            exportPDFBtn.addEventListener("click", () => {
                const snapshots = getSnapshots()
                    .slice()
                    .sort((a, b) => a.date.localeCompare(b.date));
                const filtered = applySnapshotDateFilter(snapshots);

                if (!filtered.length) {
                    alert("No snapshots in selected range to export.");
                    return;
                }

                let tableHTML = `
                    <table>
                        <thead>
                            <tr>
                                <th>Date</th>
                                <th>Symbol</th>
                                <th>Session</th>
                                <th>Open</th>
                                <th>Close</th>
                                <th>Trend</th>
                            </tr>
                        </thead>
                        <tbody>
                `;

                filtered.forEach(s => {
                    let symbolDisplay = "";
                    if (s.symbolType) {
                        if (s.symbolType === "Custom") {
                            symbolDisplay = s.customSymbol || "Custom";
                        } else {
                            symbolDisplay = s.symbolType;
                        }
                    } else {
                        symbolDisplay = s.symbol || "";
                    }

                    tableHTML += `
                        <tr>
                            <td>${formatDateDisplay(s.date)}</td>
                            <td>${symbolDisplay}</td>
                            <td>${s.session === "first" ? "1st half" : s.session === "second" ? "2nd half" : "Full day"}</td>
                            <td>${s.open}</td>
                            <td>${s.close}</td>
                            <td>${s.trend}</td>
                        </tr>
                    `;
                });

                tableHTML += "</tbody></table>";
                openPrintWindowWithHTML("Market Snapshot (Manual Logging)", tableHTML);
            });
        }
    }

    // ----------------- Trades export -----------------

    
    
    
    function setupTradesDateFilters() {
        const tradesFromInput = document.getElementById("tradesFromDate");
        const tradesToInput = document.getElementById("tradesToDate");
        const resetBtn = document.getElementById("tradesDateResetBtn");

        if (tradesFromInput) {
            tradesFromInput.addEventListener("change", () => {
                refreshTradesTable();
            });
        }
        if (tradesToInput) {
            tradesToInput.addEventListener("change", () => {
                refreshTradesTable();
            });
        }
        if (resetBtn) {
            resetBtn.addEventListener("click", () => {
                if (tradesFromInput) tradesFromInput.value = "";
                if (tradesToInput) tradesToInput.value = "";
                refreshTradesTable();
            });
        }
    }



    function setupSnapshotSummaryExports() {
        const exportSummaryCSVBtn = document.getElementById("snapshotSummaryExportCSV");
        const exportSummaryPDFBtn = document.getElementById("snapshotSummaryExportPDF");

        if (exportSummaryCSVBtn) {
            exportSummaryCSVBtn.addEventListener("click", () => {
                const rows = getSnapshotSummaryRows();
                if (!rows.length) {
                    alert("No summary rows in selected range to export.");
                    return;
                }

                const headers = ["Date", "Symbol", "O → C", "1st Half", "2nd Half", "Day Trend"];
                const csvRows = rows.map(row => {
                    const ocText =
                        row.dayOpen != null && row.dayClose != null
                            ? row.dayOpen + " → " + row.dayClose
                            : "";
                    return [
                        formatDateDisplay(row.date),
                        row.symbolDisplay,
                        ocText,
                        row.firstHalfSummary || "",
                        row.secondHalfSummary || "",
                        row.dayTrend || ""
                    ];
                });

                const csv = createCSVContent(headers, csvRows);
                const filename = `snapshot_summary_${getTodayISO().replace(/-/g, "")}.csv`;
                downloadCSV(filename, csv);
            });
        }

        if (exportSummaryPDFBtn) {
            exportSummaryPDFBtn.addEventListener("click", () => {
                const rows = getSnapshotSummaryRows();
                if (!rows.length) {
                    alert("No summary rows in selected range to export.");
                    return;
                }

                let tableHTML = `
                    <table>
                        <thead>
                            <tr>
                                <th>Date</th>
                                <th>Symbol</th>
                                <th>O → C</th>
                                <th>1st Half</th>
                                <th>2nd Half</th>
                                <th>Day Trend</th>
                            </tr>
                        </thead>
                        <tbody>
                `;

                rows.forEach(row => {
                    const ocText =
                        row.dayOpen != null && row.dayClose != null
                            ? row.dayOpen + " → " + row.dayClose
                            : "";
                    tableHTML += `
                        <tr>
                            <td>${formatDateDisplay(row.date)}</td>
                            <td>${row.symbolDisplay}</td>
                            <td>${ocText}</td>
                            <td>${row.firstHalfSummary || ""}</td>
                            <td>${row.secondHalfSummary || ""}</td>
                            <td>${row.dayTrend || ""}</td>
                        </tr>
                    `;
                });

                tableHTML += "</tbody></table>";
                openPrintWindowWithHTML("Market Snapshot – Daily Summary", tableHTML);
            });
        }
    }

function setupTradesExport() {
        const exportCSVBtn = document.getElementById("tradesExportCSV");
        const exportPDFBtn = document.getElementById("tradesExportPDF");

        if (exportCSVBtn) {
            exportCSVBtn.addEventListener("click", () => {
                const trades = getTradesForCurrentDateInputs();
                if (!trades.length) {
                    alert("No trades in selected range to export.");
                    return;
                }

                const headers = [
                    "Date",
                    "Symbol",
                    "Side",
                    "Quantity",
                    "Buy",
                    "Sell",
                    "Charges",
                    "P/L",
                    "Notes"
                ];

                const rows = trades.map(t => {
                    const symbolDisplay =
                        t.symbol === "Custom"
                            ? t.customSymbol || "Custom"
                            : t.symbol;
                    return [
                        formatDateDisplay(t.date),
                        symbolDisplay,
                        t.side,
                        t.quantity,
                        t.buyPrice,
                        t.sellPrice,
                        t.brokerage,
                        (Number(t.pl) || 0).toFixed(2),
                        t.notes || ""
                    ];
                });

                const csv = createCSVContent(headers, rows);
                const filename = `trades_customrange_${getTodayISO().replace(/-/g, "")}.csv`;
                downloadCSV(filename, csv);
            });
        }

        if (exportPDFBtn) {
            exportPDFBtn.addEventListener("click", () => {
                const trades = getTradesForCurrentDateInputs();
                if (!trades.length) {
                    alert("No trades in selected range to export.");
                    return;
                }

                let tableHTML = `
                    <table>
                        <thead>
                            <tr>
                                <th>Date</th>
                                <th>Symbol</th>
                                <th>Side</th>
                                <th>Qty</th>
                                <th>Buy</th>
                                <th>Sell</th>
                                <th>Charges</th>
                                <th>P/L</th>
                                <th>Notes</th>
                            </tr>
                        </thead>
                        <tbody>
                `;

                trades.forEach(t => {
                    const symbolDisplay =
                        t.symbol === "Custom"
                            ? t.customSymbol || "Custom"
                            : t.symbol;
                    const pl = Number(t.pl) || 0;
        // Income filter (data-based)
        if (tradeFilterState.income === 'profit' && pl <= 0) return false;
        if (tradeFilterState.income === 'loss' && pl >= 0) return false;

                    tableHTML += `
                        <tr>
                            <td>${formatDateDisplay(t.date)}</td>
                            <td>${symbolDisplay}</td>
                            <td>${t.side}</td>
                            <td>${t.quantity}</td>
                            <td>${t.buyPrice}</td>
                            <td>${t.sellPrice}</td>
                            <td>${t.brokerage}</td>
                            <td>${pl.toFixed(2)}</td>
                            <td>${t.notes || ""}</td>
                        </tr>
                    `;
                });

                tableHTML += "</tbody></table>";
                openPrintWindowWithHTML("Executed Trades (Filtered)", tableHTML);
            });
        }
    }






    
// ---------------- JSON Backup / Restore ----------------
function setupBackupRestore() {
  const backupBtn = document.getElementById("backupJsonBtn");
  const restoreBtn = document.getElementById("restoreJsonBtn");
  const fileInput = document.getElementById("restoreJsonInput");

  /* ===============================
     BACKUP
  =============================== */
  if (backupBtn) {
    backupBtn.addEventListener("click", () => {
      const payload = {
        version: "1.2",
        createdAt: new Date().toISOString(),

        /* ===== BALANCES ===== */
        mainBalance: loadNumber(STORAGE_KEYS.MAIN_BALANCE, 0),
        availableBalance: loadNumber(STORAGE_KEYS.AVAILABLE_BALANCE, 0),
        manualAdjustment: loadNumber(STORAGE_KEYS.MANUAL_ADJUST, 0),

        /* ===== CORE TABLES ===== */
        trades: getTrades(),
        depositsWithdrawals: getDepositsWithdrawals(),
        snapshots: getSnapshots(),
/* ===== GAP HISTORY ===== */
        gapHistory: loadGapHistory(),

        /* ===== UI ===== */
        theme: localStorage.getItem(THEME_KEY) || "light"
      };

      const jsonStr = JSON.stringify(payload, null, 2);
      const blob = new Blob([jsonStr], {
        type: "application/json;charset=utf-8"
      });

      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `cjcruz_backup_${getTodayISO()}.json`;

      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    });
  }

  /* ===============================
     RESTORE
  =============================== */
  if (restoreBtn && fileInput) {
    restoreBtn.addEventListener("click", () => {
      fileInput.click();
    });

    fileInput.addEventListener("change", e => {
      const file = e.target.files[0];
      if (!file) return;

      const reader = new FileReader();

      reader.onload = evt => {
        try {
          const data = JSON.parse(evt.target.result);

          if (
            !confirm(
              "Restore this backup? This will overwrite current data."
            )
          ) {
            return;
          }

          /* ===== BALANCES ===== */
          if (typeof data.mainBalance === "number") {
            saveNumber(STORAGE_KEYS.MAIN_BALANCE, data.mainBalance);
          }

          if (typeof data.availableBalance === "number") {
            saveNumber(
              STORAGE_KEYS.AVAILABLE_BALANCE,
              data.availableBalance
            );
          }

          if (typeof data.manualAdjustment === "number") {
            saveNumber(
              STORAGE_KEYS.MANUAL_ADJUST,
              data.manualAdjustment
            );
          }

          /* ===== CORE TABLES ===== */
          if (Array.isArray(data.trades)) {
            setTrades(data.trades);
          }

          if (Array.isArray(data.depositsWithdrawals)) {
            setDepositsWithdrawals(data.depositsWithdrawals);
          }

          if (Array.isArray(data.snapshots)) {
            setSnapshots(data.snapshots);
          }

          /* ===== GAP HISTORY ===== */
          if (Array.isArray(data.gapHistory)) {
            saveGapHistoryArray(data.gapHistory);
          }
          /* ===== THEME ===== */
          if (typeof data.theme === "string") {
            localStorage.setItem(THEME_KEY, data.theme);
          }

          showToast("Backup restored successfully", "success");
          location.reload();

        } catch (err) {
          console.error("Restore failed:", err);
          alert("Invalid or corrupted backup file.");
        }
      };

      reader.readAsText(file);
    });
  }
}


//end
window.exportGapHistoryPDF = function () {
  const table = document.querySelector('.gap-history-table');
  if (!table) {
    alert('Gap History table not found');
    return;
  }

  const printTable = table.cloneNode(true);

  // 🔥 REMOVE ACTION COLUMN (X)
  printTable.querySelectorAll("tr").forEach(row => {
    if (row.lastElementChild) {
      row.removeChild(row.lastElementChild);
    }
  });

  const win = window.open('', '', 'width=1200,height=800');

  win.document.write(`
    <html>
    <head>
      <title>FX → MCX Gap History</title>
      <style>
        body { font-family: Arial, sans-serif; padding: 20px; }
        h2 { text-align: center; margin-bottom: 16px; }
        table { width: 100%; border-collapse: collapse; font-size: 12px; }
        th, td { border: 1px solid #ccc; padding: 6px 8px; text-align: center; }
        th { background: #f1f5f9; }
      </style>
    </head>
    <body>
      <h2>FX → MCX Gap History</h2>
      ${printTable.outerHTML}
    </body>
    </html>
  `);

  win.document.close();
  win.focus();

  setTimeout(() => {
    win.print();
    win.close();
  }, 300);
};









    
    // ----------------- Mobile sidebar toggle -----------------

    function setupMobileSidebarToggle() {
        const menuBtn = document.getElementById("menuToggle");
        const backdrop = document.querySelector(".sidebar-backdrop");
        const sidebarLinks = document.querySelectorAll(".glass-sidebar .nav-link");

        const setSidebarOpen = (isOpen) => {
            document.body.classList.toggle("sidebar-open", isOpen);
            if (menuBtn) menuBtn.setAttribute("aria-expanded", String(isOpen));
        };

        if (menuBtn) {
            menuBtn.addEventListener("click", () => {
                setSidebarOpen(!document.body.classList.contains("sidebar-open"));
            });
        }

        if (backdrop) {
            backdrop.addEventListener("click", () => setSidebarOpen(false));
        }

        document.addEventListener("keydown", (event) => {
            if (event.key === "Escape") setSidebarOpen(false);
        });

        sidebarLinks.forEach(link => {
            link.addEventListener("click", () => {
                document.body.classList.remove("sidebar-open");
            });
        });
    }


    
    // ----------------- Sidebar active state + scroll spy -----------------

    function setupSidebarScrollSpy() {
        const links = Array.from(document.querySelectorAll(".glass-sidebar .nav-link"));
        if (!links.length) return;

        const sectionIds = [
            "section-dashboard",
            "section-add-trade",
            "section-plan-trade",
            "section-snapshot",
            "section-risk-tools",
            "section-dw",
            "section-metals-news"
        ];

        const sections = sectionIds
            .map(id => document.getElementById(id))
            .filter(Boolean);

        // click: set active immediately
        links.forEach(link => {
            link.addEventListener("click", () => {
                links.forEach(l => l.classList.remove("active"));
                link.classList.add("active");
            });
        });

        if (!("IntersectionObserver" in window) || !sections.length) {
            return;
        }

        const linkForId = id =>
            links.find(l => l.getAttribute("href") === "#" + id);

        const observer = new IntersectionObserver(
            entries => {
                // pick the entry closest to top that is intersecting
                let best = null;
                entries.forEach(entry => {
                    if (!entry.isIntersecting) return;
                    if (!best || entry.intersectionRatio > best.intersectionRatio) {
                        best = entry;
                    }
                });
                if (!best) return;

                const id = best.target.id;
                links.forEach(l => l.classList.remove("active"));
                const activeLink = linkForId(id);
                if (activeLink) activeLink.classList.add("active");
            },
            {
                root: null,
                rootMargin: "-45% 0px -55% 0px",
                threshold: [0.15, 0.35, 0.6]
            }
        );

        sections.forEach(sec => observer.observe(sec));
    }


    // ----------------- Reset all -----------------

  /************************************************
 * RESET ALL DATA – FULL & FIXED
 ************************************************/
function setupResetAll() {
  function bind() {
    const resetBtn = document.getElementById("resetAllBtn");
    if (!resetBtn || resetBtn.__bound) return;

    resetBtn.addEventListener("click", () => {
      // Require the same password modal used for balance edits before clearing data.
      // The reset runs only after the correct password is entered.
      openPasswordModal("Reset all data", doReset);
    });

    resetBtn.__bound = true;
  }

  function doReset() {

    /* ===============================
       CLEAR STORAGE KEYS
    =============================== */
    if (typeof STORAGE_KEYS === "object") {
      Object.values(STORAGE_KEYS).forEach(key => {
        localStorage.removeItem(key);
      });
    }
    /* ===============================
       GAP HISTORY RESET
    =============================== */
    try {
      localStorage.removeItem(GAP_HISTORY_KEY);
      if (typeof saveGapHistoryArray === "function") {
        saveGapHistoryArray([]);
      }
      if (typeof renderGapHistoryTable === "function") {
        renderGapHistoryTable();
      }
    } catch (e) {}

    /* ===============================
       GLOBAL UI REFRESH
    =============================== */
    window.dispatchEvent(new Event("app:reset"));

    if (typeof refreshTradesTable === "function") refreshTradesTable();
    if (typeof refreshDWTable === "function") refreshDWTable();
    if (typeof refreshSnapshotTable === "function") refreshSnapshotTable();
    if (typeof refreshSnapshotSummaryTable === "function") refreshSnapshotSummaryTable();
    if (typeof refreshBalancesAndStats === "function") refreshBalancesAndStats();
    if (typeof window.refreshTradeCalendar === "function") window.refreshTradeCalendar();

    showToast("All data reset", "danger");
  }

  // Bind immediately
  bind();

  // Bind again after DOM settles (important for long pages)
  setTimeout(bind, 0);
}


    

    function setupSnapshotDateFilters() {
        const fromInput = document.getElementById("snapshotFromDate");
        const toInput = document.getElementById("snapshotToDate");

        [fromInput, toInput].forEach(input => {
            if (input) {
                input.addEventListener("change", () => {
                    refreshSnapshotTable();
                refreshSnapshotSummaryTable();
                });
            }
        });
    }


    
    
    
// ----------------- Trades Calendar (per-day Buy / Sell colored view) -----------------

    function setupTradeCalendarModule() {
        const monthInput = document.getElementById("tradeCalendarMonth");
        const grid = document.getElementById("tradeCalendarGrid");
        const modalBackdrop = document.getElementById("tradeCalendarModalBackdrop");
        const modalCloseBtn = document.getElementById("tradeCalendarModalClose");
        const modalDateEl = document.getElementById("tradeCalendarModalDate");
        const modalSummaryEl = document.getElementById("tradeCalendarModalSummary");
        const modalTradesEl = document.getElementById("tradeCalendarModalTrades");
        const modalMoneyEl = document.getElementById("tradeCalendarModalMoney");
        const modalSnapshotsEl = document.getElementById("tradeCalendarModalSnapshots");

        if (!monthInput || !grid) return;

        function getMonthFromInput() {
            const value = monthInput.value;
            if (!value || !/^\d{4}-\d{2}$/.test(value)) {
                const today = getTodayISO();
                return {
                    year: Number(today.slice(0, 4)),
                    monthIndex: Number(today.slice(5, 7)) - 1
                };
            }
            const [y, m] = value.split("-");
            return { year: Number(y), monthIndex: Number(m) - 1 };
        }


        function classifyDay(trades, netPL, snapshots) {
            // NEW LOGIC:
            // Calendar color should come ONLY from Market Open & Close (snapshots),
            // not from Trades P/L. We completely ignore trades & netPL here.
            const snaps = Array.isArray(snapshots) ? snapshots : [];

            if (!snaps.length) {
                // No Market Open & Close for this date -> treat as empty / neutral
                return { cls: "", tone: "" };
            }

            // Try to derive bullish / bearish from snapshot trend text first
            const trends = snaps
                .map(s => (s.trend || "").toString().trim().toUpperCase())
                .filter(Boolean);

            let bullish = false;
            let bearish = false;

            if (trends.length) {
                bullish = trends.some(t =>
                    t.includes("BUY") || t.includes("BULL") || t.includes("UP")
                );
                bearish = trends.some(t =>
                    t.includes("SELL") || t.includes("BEAR") || t.includes("DOWN")
                );
            }

            // If trend text is not clear, fall back to Open vs Close
            if (!bullish && !bearish) {
                const opens = snaps
                    .map(s => Number(s.open))
                    .filter(v => Number.isFinite(v));
                const closes = snaps
                    .map(s => Number(s.close))
                    .filter(v => Number.isFinite(v));

                if (opens.length && closes.length) {
                    const dayOpen = opens[0];              // assume first snapshot = opening
                    const dayClose = closes[closes.length - 1]; // last snapshot = closing
                    if (dayClose > dayOpen) bullish = true;
                    else if (dayClose < dayOpen) bearish = true;
                }
            }

            if (bullish && !bearish) {
                // Bullish day -> keep using "buy-day" (green) styling
                return { cls: "buy-day", tone: "buy" };
            }
            if (bearish && !bullish) {
                // Bearish day -> keep using "sell-day" (red) styling
                return { cls: "sell-day", tone: "sell" };
            }
            if (bullish && bearish) {
                return { cls: "mixed-day", tone: "mixed" };
            }

            // Some snapshot present but neither clearly bullish nor bearish
            return { cls: "mixed-day", tone: "mixed" };
        }

        function buildCalendar() {
            const tradesAll = getTrades();
            const snapshotsAll = getSnapshots ? getSnapshots() : [];
            const dwAll = getDepositsWithdrawals ? getDepositsWithdrawals() : [];

            const { year, monthIndex } = getMonthFromInput();
            const first = new Date(year, monthIndex, 1);
            const startWeekday = first.getDay(); // 0=Sun
            const daysInMonth = new Date(year, monthIndex + 1, 0).getDate();

            grid.innerHTML = "";

            // Leading blanks
            for (let i = 0; i < startWeekday; i++) {
                const cell = document.createElement("div");
                cell.className = "trade-calendar-day trade-calendar-day-empty";
                grid.appendChild(cell);
            }

            for (let day = 1; day <= daysInMonth; day++) {
                const cell = document.createElement("div");
                cell.className = "trade-calendar-day";
                const dateISO = [
                    String(year),
                    String(monthIndex + 1).padStart(2, "0"),
                    String(day).padStart(2, "0")
                ].join("-");

                const trades = tradesAll.filter(t => t.date === dateISO);
                const netPL = trades.reduce((sum, t) => sum + (Number(t.pl) || 0), 0);
                const snapshots = snapshotsAll.filter(s => s.date === dateISO);
                const dwEntries = dwAll.filter(e => normalizeTradeDateToISO(e.date) === dateISO);
                const depositTotal = dwEntries.filter(e => e.type === "Deposit").reduce((sum, e) => sum + (Number(e.amount) || 0), 0);
                const withdrawalTotal = dwEntries.filter(e => e.type === "Withdrawal").reduce((sum, e) => sum + (Number(e.amount) || 0), 0);

                const dayNumber = document.createElement("div");
                dayNumber.className = "trade-calendar-day-number";
                dayNumber.textContent = String(day);

                const plLabel = document.createElement("div");
                plLabel.className = "trade-calendar-day-pl";

                if (snapshots.length) {
                    // NEW: derive a single day Open / Close from Market Open & Close
                    const firstSnap = snapshots[0];
                    const lastSnap = snapshots[snapshots.length - 1];
                    const dayOpen = Number(firstSnap.open);
                    const dayClose = Number(lastSnap.close);

                    if (Number.isFinite(dayOpen) && Number.isFinite(dayClose)) {
                        plLabel.textContent = `O ${dayOpen} → C ${dayClose}`;
                    } else {
                        // Fallback: show symbol / count if numbers not available
                        plLabel.textContent = firstSnap.symbol || (snapshots.length + " snaps");
                    }
                } else if (trades.length) {
                    // If no Market Open & Close, we still allow showing P/L number,
                    // but day color will remain neutral because classifyDay ignores trades.
                    plLabel.textContent = formatCurrency(netPL);
                } else {
                    plLabel.textContent = "";
                }

                cell.appendChild(dayNumber);
                if (plLabel.textContent) {
                    cell.appendChild(plLabel);
                }

                // Show deposits and withdrawals directly on their calendar date.
                if (depositTotal > 0) {
                    const depositLabel = document.createElement("div");
                    depositLabel.className = "trade-calendar-money-tag trade-calendar-deposit-tag";
                    depositLabel.textContent = `+ In ${formatCurrency ? formatCurrency(depositTotal) : depositTotal.toFixed(2)}`;
                    cell.appendChild(depositLabel);
                }
                if (withdrawalTotal > 0) {
                    const withdrawalLabel = document.createElement("div");
                    withdrawalLabel.className = "trade-calendar-money-tag trade-calendar-withdrawal-tag";
                    withdrawalLabel.textContent = `− Out ${formatCurrency ? formatCurrency(withdrawalTotal) : withdrawalTotal.toFixed(2)}`;
                    cell.appendChild(withdrawalLabel);
                }

                // classify for color + small trend tag
                const { cls, tone } = classifyDay(trades, netPL, snapshots);
                if (trades.length || snapshots.length || dwEntries.length) {
                    cell.classList.add("has-data");
                    if (cls) cell.classList.add(cls);

                    if (tone) {
                        const trendTag = document.createElement("div");
                        trendTag.className = "trade-calendar-day-trend-tag trend-" + tone;
                        if (tone === "buy") trendTag.textContent = "Trend: Buy";
                        else if (tone === "sell") trendTag.textContent = "Trend: Sell";
                        else trendTag.textContent = "Trend: Mix";
                        cell.appendChild(trendTag);
                    }

                } else {
                    cell.classList.add("trade-calendar-day-empty");
                }
                // Every date is clickable, including dates with no saved entries.
                cell.setAttribute("role", "button");
                cell.setAttribute("tabindex", "0");
                cell.setAttribute("aria-label", `View details for ${dateISO}`);
                cell.addEventListener("click", () => openDetailsModal(dateISO));
                cell.addEventListener("keydown", (event) => {
                    if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        openDetailsModal(dateISO);
                    }
                });

                grid.appendChild(cell);
            }
        }

        function openDetailsModal(dateISO) {
            if (!modalBackdrop || !modalDateEl || !modalSummaryEl || !modalTradesEl || !modalMoneyEl || !modalSnapshotsEl) return;

            const allTrades = getTrades();
            const allSnapshots = getSnapshots ? getSnapshots() : [];
            const allDW = getDepositsWithdrawals ? getDepositsWithdrawals() : [];

            const trades = allTrades.filter(t => normalizeTradeDateToISO(t.date) === dateISO);
            const snapshots = allSnapshots.filter(s => normalizeTradeDateToISO(s.date) === dateISO);
            const dwEntries = allDW.filter(e => normalizeTradeDateToISO(e.date) === dateISO);
            const netPL = trades.reduce((sum, t) => sum + (Number(t.pl) || 0), 0);
            const profit = trades.reduce((sum, t) => sum + Math.max(0, Number(t.pl) || 0), 0);
            const loss = trades.reduce((sum, t) => sum + Math.abs(Math.min(0, Number(t.pl) || 0)), 0);
            const depositTotal = dwEntries.filter(e => String(e.type).toLowerCase() === "deposit").reduce((sum, e) => sum + (Number(e.amount) || 0), 0);
            const withdrawalTotal = dwEntries.filter(e => String(e.type).toLowerCase() === "withdrawal").reduce((sum, e) => sum + (Number(e.amount) || 0), 0);

            const buys = trades.filter(t => t.side === "Buy").length;
            const sells = trades.filter(t => t.side === "Sell").length;

            modalDateEl.textContent = formatDateDisplay ? formatDateDisplay(dateISO) : dateISO;

            // Keep dates with no saved activity simple: show only the selected date
            // and a short empty-state message instead of all the zero-value sections.
            const modalBody = modalBackdrop ? modalBackdrop.querySelector(".trade-calendar-modal-body") : null;
            const hasActivity = trades.length > 0 || dwEntries.length > 0 || snapshots.length > 0;
            if (modalBody) modalBody.classList.toggle("is-empty-day", !hasActivity);
            if (!hasActivity) {
                modalSummaryEl.innerHTML = '<div class="trade-calendar-empty-day">No activity recorded for this date.</div>';
                modalMoneyEl.innerHTML = "";
                modalTradesEl.innerHTML = "";
                modalSnapshotsEl.innerHTML = "";
                modalBackdrop.classList.add("show");
                return;
            }

            const plText = formatCurrency ? formatCurrency(netPL) : String(netPL.toFixed ? netPL.toFixed(2) : netPL);

            let trendText = "";
            let ocText = "";
            if (snapshots.length) {
                const trendVals = snapshots
                    .map(s => s.trend)
                    .filter(v => typeof v === "string" && v.trim().length > 0);
                if (trendVals.length) {
                    trendText = trendVals[0];
                }

                // Derive single day Open / Close from first & last snapshot
                const firstSnap = snapshots[0];
                const lastSnap = snapshots[snapshots.length - 1];
                const dayOpen = Number(firstSnap.open);
                const dayClose = Number(lastSnap.close);
                if (Number.isFinite(dayOpen) && Number.isFinite(dayClose)) {
                    ocText = `O ${dayOpen} → C ${dayClose}`;
                }
            }

            const money = value => formatCurrency ? formatCurrency(value) : Number(value || 0).toFixed(2);
            modalSummaryEl.innerHTML = `
              <span><strong>Profit:</strong> <b style="color:#15803d">${money(profit)}</b></span>
              <span><strong>Loss:</strong> <b style="color:#dc2626">${money(loss)}</b></span>
              <span><strong>Net P/L:</strong> <b style="color:${netPL >= 0 ? '#15803d' : '#dc2626'}">${plText}</b></span>
              <span><strong>Deposits:</strong> <b style="color:#15803d">${money(depositTotal)}</b></span>
              <span><strong>Withdrawals:</strong> <b style="color:#dc2626">${money(withdrawalTotal)}</b></span>
              <span><strong>Trades:</strong> ${trades.length} (Buy: ${buys}, Sell: ${sells})</span>
              ${ocText ? `<span><strong>Day O/C:</strong> ${ocText}</span>` : ""}
              ${trendText ? `<span><strong>Trend:</strong> ${trendText}</span>` : ""}
            `;

            if (dwEntries.length) {
                const rows = dwEntries.map(e => {
                    const isDeposit = String(e.type).toLowerCase() === "deposit";
                    return `<tr><td>${isDeposit ? 'Deposit' : 'Withdrawal'}</td><td style="color:${isDeposit ? '#15803d' : '#dc2626'};font-weight:600">${isDeposit ? '+' : '−'}${money(e.amount)}</td><td>${e.note || ''}</td></tr>`;
                }).join('');
                modalMoneyEl.innerHTML = `<table class="trade-calendar-modal-table"><thead><tr><th>Type</th><th>Amount</th><th>Note</th></tr></thead><tbody>${rows}</tbody></table>`;
            } else {
                modalMoneyEl.innerHTML = '<div class="tiny-text">No deposits or withdrawals for this date.</div>';
            }

            if (trades.length) {
                const rows = trades
                    .map(t => {
                        const symbol = t.customSymbol && t.customSymbol.trim()
                            ? t.customSymbol.trim()
                            : (t.symbol || "");
                        return `
                          <tr>
                            <td>${symbol}</td>
                            <td>${t.side || ""}</td>
                            <td>${t.quantity || ""}</td>
                            <td>${formatCurrency ? formatCurrency(t.pl || 0) : (t.pl || 0)}</td>
                          </tr>
                        `;
                    })
                    .join("");
                modalTradesEl.innerHTML = `
                  <table class="trade-calendar-modal-table">
                    <thead>
                      <tr>
                        <th>Symbol</th>
                        <th>Side</th>
                        <th>Qty</th>
                        <th>P/L</th>
                      </tr>
                    </thead>
                    <tbody>
                      ${rows}
                    </tbody>
                  </table>
                `;
            } else {
                modalTradesEl.innerHTML = "<div class=\"tiny-text\">No trades logged for this date.</div>";
            }

            if (snapshots.length) {
                const rows = snapshots
                    .map(s => {
						console.log("SNAPSHOT MAP RUNNING", s.trend);
                        const symbol = s.symbol || "";
                        const openVal = typeof s.open === "number" ? s.open : (s.open || "");
                        const closeVal = typeof s.close === "number" ? s.close : (s.close || "");
                        const trend = s.trend || "";
                        const sessionLabel = s.session === "first" ? "1st half" : s.session === "second" ? "2nd half" : "Full day";
                        return `
                          <tr>
                            <td>${symbol}</td>
                            <td>${sessionLabel}</td>
                            <td>${openVal}</td>
                            <td>${closeVal}</td>
                            <td>
                                ${
                              trend === "Buy"
                               ? '<span class="badge-bullish">Buy</span>'
                              : '<span class="badge-bearish">Sell</span>'
                                    }
                                   </td>
                        `;
                    })
                    .join("");
                modalSnapshotsEl.innerHTML = `
                  <table class="trade-calendar-modal-table">
                    <thead>
                      <tr>
                        <th>Symbol</th>
                        <th>Session</th>
                        <th>Open</th>
                        <th>Close</th>
                        <th>Trend</th>
                      </tr>
                    </thead>
                    <tbody>
                      ${rows}
                    </tbody>
                  </table>
                `;
            } else {
                modalSnapshotsEl.innerHTML = "<div class=\"tiny-text\">No Market Open &amp; Close entries for this date.</div>";
            }

            modalBackdrop.classList.add("show");
        }

        function closeModal() {
            if (modalBackdrop) {
                modalBackdrop.classList.remove("show");
            }
        }

        if (modalBackdrop && !modalBackdrop.__tradeCalendarBound) {
            modalBackdrop.addEventListener("click", function (e) {
                if (e.target === modalBackdrop) {
                    closeModal();
                }
            });
            modalBackdrop.__tradeCalendarBound = true;
        }

        if (modalCloseBtn && !modalCloseBtn.__tradeCalendarBound) {
            modalCloseBtn.addEventListener("click", closeModal);
            modalCloseBtn.__tradeCalendarBound = true;
        }

        if (!monthInput.value) {
            const today = getTodayISO();
            monthInput.value = today.slice(0, 7);
        }

        monthInput.addEventListener("change", buildCalendar);

        // Expose a small helper so other parts of the app (Trades / Market Snapshot)
        // can force-refresh the Daily Map calendar immediately after saving.
        window.refreshTradeCalendar = buildCalendar;

        buildCalendar();
}



// ----------------- Daily Inspiration Popup (motivational quote) -----------------

    const DAILY_TRADING_QUOTES = [
        // Trading discipline
        "Trade with a plan. If you fail to plan, you are planning to fail.",
        "Your job is not to predict the market, but to react calmly to what it does.",
        "Risk management is your real edge. Protect capital first, grow it second.",
        "Cut losses quickly and let winners run according to your rules, not emotions.",
        "Focus on process, not profit. Profits are a byproduct of good decisions.",
        "The market rewards discipline, not excitement.",
        "No trade is also a trade. Staying out is a valid position.",
        "Trade what you see on the chart, not what you feel in your heart.",
        "A losing trade that followed your rules is a good trade. Learn and move on.",
        "Overtrading kills accounts faster than bad strategies.",
        "If a position is too big to sleep peacefully, it is too big to hold.",
        "Small, consistent profits beat big, lucky wins in the long run.",
        "You don’t need to catch every move, only the ones that match your system.",
        "Revenge trading is your ego asking for more losses.",
        "Your stop loss is your seatbelt. Respect it every time.",

        // Life mindset
        "Every day is a new chance to become 1% better than yesterday.",
        "Consistency is more powerful than motivation. Show up, even on tough days.",
        "Progress may be slow, but quitting won’t make it faster.",
        "You don’t have to be perfect, you just have to be persistent.",
        "Success is built quietly, in small decisions nobody sees.",
        "Your future is shaped by habits, not wishes.",
        "Discipline is doing what needs to be done, even when you don’t feel like it.",
        "Replace ‘I can’t’ with ‘How can I?’ and see what changes.",
        "You are one decision away from a completely different direction in life.",
        "Energy flows where attention goes. Focus on what you want to grow.",
        "Don’t compare your chapter 2 to someone else’s chapter 20.",
        "Your mindset is your strongest tool. Guard it carefully.",
        "Slow growth is still growth. Don’t underestimate small steps.",
        "You didn’t come this far just to stop here.",

        // Money & wealth mindset
        "Treat money like a tool, not a trophy.",
        "Wealth is built by discipline, not by one lucky moment.",
        "Don’t work only for money; make your money start working for you.",
        "Spending gives quick pleasure; investing gives long-term power.",
        "Rich is what you earn. Wealthy is what you keep.",
        "A budget is not restriction; it’s a roadmap to financial freedom.",
        "Small, smart decisions with money compound into big results.",
        "Avoid lifestyle jumps; let your investments grow faster than your expenses.",
        "Learning about money pays the highest interest.",
        "Protect the downside and the upside will take care of itself.",
        "Don’t chase quick money. Build strong foundations instead.",
        "It’s not about timing the market, it’s about time in the market.",
        "Your financial habits today are writing your future lifestyle.",
        "Every rupee saved and invested is a silent worker for your future.",
        "Be the person who controls money, not the one controlled by it."
    ];

    function getTodayQuoteText() {
        if (!Array.isArray(DAILY_TRADING_QUOTES) || DAILY_TRADING_QUOTES.length === 0) {
            return "Trade with discipline and patience today.";
        }
        const idx = Math.floor(Math.random() * DAILY_TRADING_QUOTES.length);
        return DAILY_TRADING_QUOTES[idx];
    }

    function openDailyInspireModal() {
        const backdrop = document.getElementById("dailyInspireBackdrop");
        const textEl = document.getElementById("dailyInspireText");
        if (!backdrop || !textEl) return;

        textEl.textContent = getTodayQuoteText();
        backdrop.classList.add("show");
    }

    function setupDailyInspirationPopup() {
        const backdrop = document.getElementById("dailyInspireBackdrop");
        const closeX = document.getElementById("dailyInspireCloseX");
        const okBtn = document.getElementById("dailyInspireOkBtn");

        if (!backdrop) return;

        function closeModal() {
            backdrop.classList.remove("show");
        }

        if (closeX && !closeX.__dailyInspireBound) {
            closeX.addEventListener("click", closeModal);
            closeX.__dailyInspireBound = true;
        }

        if (okBtn && !okBtn.__dailyInspireBound) {
            okBtn.addEventListener("click", closeModal);
            okBtn.__dailyInspireBound = true;
        }

        // click outside to close
        if (!backdrop.__dailyInspireBound) {
            backdrop.addEventListener("click", function (e) {
                if (e.target === backdrop) {
                    closeModal();
                }
            });
            backdrop.__dailyInspireBound = true;
        }

        // Always show on load with a small delay
        setTimeout(openDailyInspireModal, 600);
    }



    // ----------------- Gold / Silver News helper -----------------

    const METALS_NOTES_KEY = "cj_metals_morning_notes";

    function setupMetalsNewsSection() {
        const notesEl = document.getElementById("metalsMorningNotes");
        const goldBtn = document.getElementById("openGoldNewsBtn");
        const silverBtn = document.getElementById("openSilverNewsBtn");

        // Load saved notes from localStorage
        if (notesEl) {
            try {
                const saved = localStorage.getItem(METALS_NOTES_KEY);
                if (typeof saved === "string") {
                    notesEl.value = saved;
                }
            } catch (err) {
                console.warn("Could not load metals notes:", err);
            }

            notesEl.addEventListener("input", () => {
                try {
                    localStorage.setItem(METALS_NOTES_KEY, notesEl.value || "");
                } catch (err) {
                    console.warn("Could not save metals notes:", err);
                }
            });
        }

        // Helper to open Google News search
        function openNews(term) {
            const query = encodeURIComponent(term + " mcx news today");
            const url =
                "https://www.google.com/search?tbm=nws&q=" + query;
            window.open(url, "_blank", "noopener");
        }

        if (goldBtn) {
            goldBtn.addEventListener("click", () => openNews("gold"));
        }
        if (silverBtn) {
            silverBtn.addEventListener("click", () => openNews("silver"));
        }
    }

// ----------------- Initial boot -----------------

    document.addEventListener("DOMContentLoaded", () => {
        if (localStorage.getItem(STORAGE_KEYS.MAIN_BALANCE) === null) {
            saveNumber(STORAGE_KEYS.MAIN_BALANCE, 0);
        }
        if (localStorage.getItem(STORAGE_KEYS.AVAILABLE_BALANCE) === null) {
            saveNumber(STORAGE_KEYS.AVAILABLE_BALANCE, 0);
        }
        if (localStorage.getItem(STORAGE_KEYS.MANUAL_ADJUST) === null) {
            saveNumber(STORAGE_KEYS.MANUAL_ADJUST, 0);
        }

        applyThemeFromStorage();
        setupThemeToggle();

        setupProfileAvatar();

        setupBalanceButtons();
        setupTradeForm();
        setupDWModule();
        setupSnapshotModule();
        setupSnapshotSummaryExports();
        setupTradeCalendarModule();
        setupSnapshotDateFilters();
        setupTradesExport();
        setupTradesDateFilters();
        setupBackupRestore();
        setupMobileSidebarToggle();
        setupSidebarScrollSpy();
        setupResetAll();
		

        // Metals news section
        setupMetalsNewsSection();

        // NEW tools
        setupPlanTradeTool();
        setupRiskTools();

        // Daily motivational popup
        setupDailyInspirationPopup();

        refreshTradesTable();
        refreshDWTable();
        refreshSnapshotTable();
        refreshSnapshotSummaryTable();
        refreshBalancesAndStats();
		
		// ✅ FX → MCX GAP MAPPER INIT
  renderGapHistoryTable();
  updateGapSummary();
    });
	
	
	
    
    // ----------------- Live Market Ticker -----------------

    // remember last prices so we can show ▲ / ▼
    const lastTickerPrices = {};

    
    function renderTickerLine(tickerEl, items) {
        const parts = items.map(item => {
            let status = "flat";

            if (item.price != null && !Number.isNaN(item.price)) {
                const prev = lastTickerPrices[item.key];

                if (prev !== undefined) {
                    if (item.price > prev) {
                        status = "up";
                    } else if (item.price < prev) {
                        status = "down";
                    }
                }

                // remember latest price
                lastTickerPrices[item.key] = item.price;

                const decimals =
                    typeof item.decimals === "number" ? item.decimals : 1;
                const priceStr = item.price.toFixed(decimals);
                const currency = item.currency || "";

                // percentage change vs previous price
                let pctStr = "";
                const prevValid = typeof prev === "number" && !Number.isNaN(prev) && prev !== 0;
                let changePct = 0;

                if (prevValid) {
                    changePct = ((item.price - prev) / prev) * 100;
                }

                const absPct = Math.abs(changePct).toFixed(2);

                if (status === "up") {
                    pctStr = `+${absPct}%`;
                } else if (status === "down") {
                    pctStr = `-${absPct}%`;
                } else {
                    pctStr = `${absPct}%`;
                }

                // arrow badge: only show arrow for up-move (user preference),
                // keep a subtle dot for flat / down.
                let badgeSymbol = "•";
                if (status === "up") badgeSymbol = "▲";

                const outerClass = `ticker-item ticker-${status}`;
                const badgeClass = `ticker-badge ticker-${status}`;

                return `<span class="${outerClass}"><span class="ticker-label">${item.label}:</span><span class="ticker-price">${currency}${priceStr}</span><span class="ticker-extra">${pctStr}</span><span class="${badgeClass}">${badgeSymbol}</span></span>`;
            } else {
                return `<span class="ticker-item ticker-flat"><span class="ticker-label">${item.label}:</span><span class="ticker-price">—</span><span class="ticker-extra">0.00%</span><span class="ticker-badge ticker-flat">•</span></span>`;
            }
        });

        tickerEl.innerHTML = parts.join("");
    }

function simulateMarketTicker() {
        const tickerEl = document.getElementById("marketTickerText");
        if (!tickerEl) return;

        const baseXau = lastTickerPrices["XAUUSD"] || 2300;
        const baseXag = lastTickerPrices["XAGUSD"] || 28;
        const baseMcxGold = lastTickerPrices["MCXGOLD"] || 68000;
        const baseMcxSilver = lastTickerPrices["MCXSILVER"] || 80000;
        const baseNifty = lastTickerPrices["NIFTY50"] || 22500;
        const baseBankNifty = lastTickerPrices["BANKNIFTY"] || 48000;

        const items = [
            {
                key: "XAUUSD",
                label: "XAUUSD",
                price: baseXau + (Math.random() - 0.5) * 5,
                decimals: 2,
                currency: "$"
            },
            {
                key: "XAGUSD",
                label: "XAGUSD",
                price: baseXag + (Math.random() - 0.5) * 0.2,
                decimals: 3,
                currency: "$"
            },
            {
                key: "MCXGOLD",
                label: "MCX GOLD",
                price: baseMcxGold + (Math.random() - 0.5) * 80,
                decimals: 1,
                currency: "₹"
            },
            {
                key: "MCXSILVER",
                label: "MCX SILVER",
                price: baseMcxSilver + (Math.random() - 0.5) * 120,
                decimals: 1,
                currency: "₹"
            },
            {
                key: "NIFTY50",
                label: "NIFTY 50",
                price: baseNifty + (Math.random() - 0.5) * 40,
                decimals: 1
            },
            {
                key: "BANKNIFTY",
                label: "BANK NIFTY",
                price: baseBankNifty + (Math.random() - 0.5) * 90,
                decimals: 1
            }
        ];

        renderTickerLine(tickerEl, items);
    }

    // initial render + refresh every 20 sec
    simulateMarketTicker();
    setInterval(simulateMarketTicker, 20000);



})();




(function() {
    // persist collapsed state in localStorage
    const KEY = "cj_sidebar_collapsed";
    function applyState() {
        const collapsed = localStorage.getItem(KEY) === "1";
        if (collapsed) document.body.classList.add("sidebar-collapsed");
        else document.body.classList.remove("sidebar-collapsed");
    }
    document.addEventListener("DOMContentLoaded", function () {
        applyState();
        const btn = document.getElementById("sidebarToggleArrow");
        if (!btn) return;
        btn.addEventListener("click", function () {
            const collapsed = document.body.classList.toggle("sidebar-collapsed");
            try {
                localStorage.setItem(KEY, collapsed ? "1" : "0");
            } catch (e) { /* ignore storage errors */ }
        });
    });
})();




(function() {
    const KEY = "cj_sidebar_collapsed";
    function applyState() {
        const collapsed = localStorage.getItem(KEY) === "1";
        if (collapsed) document.body.classList.add("sidebar-collapsed");
        else document.body.classList.remove("sidebar-collapsed");
    }
    document.addEventListener("DOMContentLoaded", function () {
        applyState();
        const btn = document.getElementById("sidebarToggleArrow");
        if (!btn) return;
        btn.addEventListener("click", function (e) {
            e.stopPropagation();
            const collapsed = document.body.classList.toggle("sidebar-collapsed");
            try {
                localStorage.setItem(KEY, collapsed ? "1" : "0");
            } catch (err) {}
            btn.style.transform = collapsed ? "rotate(180deg)" : "rotate(0deg)";
        });
    });
})();



/* === FINAL JS ENFORCEMENT: ensure single toggle and sync visuals === */
(function finalSidebarEnforcement() {
    function ensureMutualExclusive() {
        // If both classes exist, prefer sidebar-open (mobile) when window width < 992, otherwise prefer sidebar-collapsed
        const body = document.body;
        const w = window.innerWidth || document.documentElement.clientWidth;
        const hasOpen = body.classList.contains('sidebar-open');
        const hasCollapsed = body.classList.contains('sidebar-collapsed');

        if (hasOpen && hasCollapsed) {
            if (w < 992) {
                // mobile view: remove collapsed
                body.classList.remove('sidebar-collapsed');
            } else {
                // desktop view: remove open
                body.classList.remove('sidebar-open');
            }
        }
    }

    function syncVisuals() {
        const body = document.body;
        const inBtn = document.getElementById('sidebarToggleArrow');
        const fixed = document.getElementById('sidebarArrowFixed');
        // Sync inBtn class
        if (inBtn) {
            if (body.classList.contains('sidebar-collapsed')) inBtn.classList.add('is-collapsed');
            else inBtn.classList.remove('is-collapsed');
        }
        // Sync fixed button visibility
        if (fixed) {
            if (body.classList.contains('sidebar-collapsed') && !body.classList.contains('sidebar-open')) {
                fixed.style.display = 'inline-flex';
                fixed.style.opacity = '1';
                fixed.style.pointerEvents = 'auto';
            } else {
                fixed.style.display = 'inline-flex';
                fixed.style.opacity = '0';
                fixed.style.pointerEvents = 'auto';
            }
        }
    }

    // Wrap toggle functions to enforce mutual exclusivity
    const originalToggle = window.toggleSidebarCollapsed;
    window.toggleSidebarCollapsed = function(force) {
        // call original if exists to preserve behavior
        if (typeof originalToggle === 'function') originalToggle(force);
        // enforce mutual exclusivity right after toggle
        ensureMutualExclusive();
        syncVisuals();
    };

    // Also ensure mobile menu toggle behaves
    const originalMobileToggle = (function() {
        const el = document.getElementById('menuToggle');
        if (el && !el.__finalBound) {
            el.addEventListener('click', () => {
                document.body.classList.toggle('sidebar-open');
                // remove collapsed if opening mobile menu
                if (document.body.classList.contains('sidebar-open')) document.body.classList.remove('sidebar-collapsed');
                // sync visuals
                syncVisuals();
            });
            el.__finalBound = true;
            return true;
        }
        return false;
    })();

    // Observe body class changes to re-sync visuals (covers other scripts)
    const obs = new MutationObserver(function() {
        ensureMutualExclusive();
        syncVisuals();
    });
    obs.observe(document.body, { attributes: true, attributeFilter: ['class'] });

    // initial sync after DOM loaded
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', function() {
            ensureMutualExclusive();
            syncVisuals();
        });
    } else {
        ensureMutualExclusive();
        syncVisuals();
    }

    // Also on resize, re-evaluate
    window.addEventListener('resize', function() {
        ensureMutualExclusive();
        syncVisuals();
    });
})();



// === Reliable hamburger & sidebar binding (added by ChatGPT) ===
(function ensureHamburgerBindings() {
    function bindMenuToggle() {
        const old = document.getElementById('menuToggle');
        if (!old) return;
        // Replace with clone to remove previous listeners
        const clone = old.cloneNode(true);
        old.parentNode.replaceChild(clone, old);
        clone.id = 'menuToggle'; // preserve id
        clone.classList.add('mobile-menu-btn');
        clone.setAttribute('aria-label', 'Open menu');
        clone.setAttribute('type', 'button');
        clone.addEventListener('click', () => {
            // Toggle mobile overlay; when opening mobile overlay, make sure sidebar-collapsed is removed
            const body = document.body;
            const opening = !body.classList.contains('sidebar-open');
            if (opening) {
                body.classList.add('sidebar-open');
                body.classList.remove('sidebar-collapsed');
            } else {
                body.classList.remove('sidebar-open');
            }
        });
        // keyboard support
        clone.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' || e.key === ' ' || e.key === 'Spacebar') {
                e.preventDefault();
                clone.click();
            }
        });
    }

    function bindInSidebarToggle() {
        const old = document.getElementById('sidebarToggleArrow');
        if (!old) return;
        const clone = old.cloneNode(true);
        old.parentNode.replaceChild(clone, old);
        clone.id = 'sidebarToggleArrow';
        clone.type = 'button';
        clone.setAttribute('aria-label', 'Toggle sidebar');
        // ensure initial aria-pressed matches body state
        const sync = () => {
            const isCollapsed = document.body.classList.contains('sidebar-collapsed');
            clone.setAttribute('aria-pressed', String(isCollapsed));
            if (isCollapsed) clone.classList.add('is-collapsed');
            else clone.classList.remove('is-collapsed');
        };
        sync();
        clone.addEventListener('click', (e) => {
            e.preventDefault();
            const body = document.body;
            const willCollapse = !body.classList.contains('sidebar-collapsed');
            if (willCollapse) {
                body.classList.add('sidebar-collapsed');
                body.classList.remove('sidebar-open');
            } else {
                body.classList.remove('sidebar-collapsed');
            }
            // sync visual state
            sync();
        });
        clone.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' || e.key === ' ' || e.key === 'Spacebar') {
                e.preventDefault();
                clone.click();
            }
        });
    }

    function bindFixedReopen() {
        let fixed = document.getElementById('sidebarArrowFixed');
        if (!fixed) {
            // create minimal fixed button if missing
            fixed = document.createElement('button');
            fixed.id = 'sidebarArrowFixed';
            fixed.type = 'button';
            fixed.setAttribute('aria-label', 'Open sidebar');
            fixed.style.position = 'fixed';
            fixed.style.top = '18px';
            fixed.style.left = '12px';
            fixed.style.width = '44px';
            fixed.style.height = '44px';
            fixed.style.borderRadius = '999px';
            fixed.style.zIndex = '1200';
            fixed.style.display = 'none';
            fixed.style.alignItems = 'center';
            fixed.style.justifyContent = 'center';
            fixed.innerHTML = '<svg viewBox=\"0 0 24 24\" width=\"18\" height=\"18\" xmlns=\"http://www.w3.org/2000/svg\"><path d=\"M15 18l-6-6 6-6\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\"/></svg>';
            document.body.appendChild(fixed);
        } else {
            // replace to remove old listeners
            const clone = fixed.cloneNode(true);
            fixed.parentNode.replaceChild(clone, fixed);
            fixed = clone;
        }
        // bind
        fixed.addEventListener('click', (e) => {
            e.preventDefault();
            // open sidebar (remove collapsed)
            document.body.classList.remove('sidebar-collapsed');
            document.body.classList.remove('sidebar-open'); // ensure overlay not present
            // hide fixed button after opening
            fixed.style.display = 'none';
            fixed.style.pointerEvents = 'none';
            // also sync in-sidebar button if present
            const inBtn = document.getElementById('sidebarToggleArrow');
            if (inBtn) inBtn.classList.remove('is-collapsed');
        });
        // sync visibility based on body classes
        const syncFixed = () => {
            if (document.body.classList.contains('sidebar-collapsed') && !document.body.classList.contains('sidebar-open')) {
                fixed.style.display = 'inline-flex';
                fixed.style.opacity = '1';
                fixed.style.pointerEvents = 'auto';
            } else {
                fixed.style.display = 'none';
                fixed.style.opacity = '0';
                fixed.style.pointerEvents = 'none';
            }
        };
        // observe changes to body class to sync
        const mo = new MutationObserver(syncFixed);
        mo.observe(document.body, { attributes: true, attributeFilter: ['class'] });
        // initial sync
        syncFixed();
    }

    function initAll() {
        bindMenuToggle();
        bindInSidebarToggle();
        bindFixedReopen();
        // also ensure mutual exclusivity: sidebar-open and sidebar-collapsed should not both exist
        const mo = new MutationObserver(() => {
            const b = document.body;
            if (b.classList.contains('sidebar-open') && b.classList.contains('sidebar-collapsed')) {
                // prefer sidebar-open on small screens, otherwise prefer collapsed on desktop
                if (window.innerWidth < 992) b.classList.remove('sidebar-collapsed');
                else b.classList.remove('sidebar-open');
            }
        });
        mo.observe(document.body, { attributes: true, attributeFilter: ['class'] });
    }

    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initAll);
    else initAll();
})();





    // ----------------- FX → MCX Gap Mapper helper -----------------

    const GAP_HISTORY_KEY = "cj_fx_mcx_gap_history_v1";
    const FX_GAP_CLEAR_PASSWORD = "cjcruz";// change if you want

    function calculateFxToMcxGap() {
        const pair = document.getElementById("fxPair")?.value;
        const fxNight = parseFloat(document.getElementById("fxNightClose")?.value);
        const fxMorning = parseFloat(document.getElementById("fxMorning")?.value);
        const mcxPrevClose = parseFloat(document.getElementById("mcxPrevClose")?.value);
        const impactFactor = parseFloat(document.getElementById("impactFactor")?.value);

        if (
            !pair ||
            Number.isNaN(fxNight) ||
            Number.isNaN(fxMorning) ||
            Number.isNaN(mcxPrevClose) ||
            Number.isNaN(impactFactor)
        ) {
            if (typeof showToast === "function") {
                showToast("Please fill all fields correctly in FX → MCX Gap Mapper.", "danger");
            }
            return;
        }

        const fxMovePoints = fxMorning - fxNight;
        const fxMovePercent = (fxMovePoints / fxNight) * 100;

        const mcxGap = fxMovePoints * impactFactor;
        const mcxEstimatedOpen = mcxPrevClose + mcxGap;

        const fxMovePointsEl = document.getElementById("fxMovePoints");
        const fxMovePercentEl = document.getElementById("fxMovePercent");
        const mcxGapEl = document.getElementById("mcxGap");
        const mcxEstimatedOpenEl = document.getElementById("mcxEstimatedOpen");
        const gapCommentEl = document.getElementById("gapCommentText");
        const resultBox = document.getElementById("gapResultBox");

        if (fxMovePointsEl) fxMovePointsEl.textContent = fxMovePoints.toFixed(3);
        if (fxMovePercentEl) fxMovePercentEl.textContent = fxMovePercent.toFixed(3) + " %";
        if (mcxGapEl) mcxGapEl.textContent = mcxGap.toFixed(1);
        if (mcxEstimatedOpenEl) mcxEstimatedOpenEl.textContent = mcxEstimatedOpen.toFixed(1);

        let comment = "";

        // --- Badge element (created only once, no HTML change) ---
        let badgeEl = document.getElementById("gapBadge");
        if (!badgeEl && resultBox) {
            badgeEl = document.createElement("div");
            badgeEl.id = "gapBadge";
            badgeEl.className = "gap-badge";
            resultBox.insertBefore(badgeEl, resultBox.firstChild);
        }

        // Reset + apply color for Estimated MCX Open value
        if (mcxEstimatedOpenEl) {
            mcxEstimatedOpenEl.classList.remove("est-open-up", "est-open-down", "est-open-flat");

            if (fxMovePoints > 0) {
                mcxEstimatedOpenEl.classList.add("est-open-up");
            } else if (fxMovePoints < 0) {
                mcxEstimatedOpenEl.classList.add("est-open-down");
            } else {
                mcxEstimatedOpenEl.classList.add("est-open-flat");
            }
        }

        // Highlight whole result card + set badge + view text
        if (resultBox) {
            resultBox.classList.remove("gap-bullish", "gap-bearish", "gap-flat");

            if (fxMovePoints > 0) {
                // bullish
                resultBox.classList.add("gap-bullish");
                comment = "Bullish bias · Gap up expected on MCX open.";

                if (badgeEl) {
                    badgeEl.textContent = "📈 Bullish Gap";
                    badgeEl.classList.remove("badge-bearish", "badge-flat");
                    badgeEl.classList.add("badge-bullish");
                }
            } else if (fxMovePoints < 0) {
                // bearish
                resultBox.classList.add("gap-bearish");
                comment = "Bearish bias · Gap down expected on MCX open.";

                if (badgeEl) {
                    badgeEl.textContent = "📉 Bearish Gap";
                    badgeEl.classList.remove("badge-bullish", "badge-flat");
                    badgeEl.classList.add("badge-bearish");
                }
            } else {
                // flat / neutral
                resultBox.classList.add("gap-flat");
                comment = "Flat / neutral bias · No major gap expected.";

                if (badgeEl) {
                    badgeEl.textContent = "➖ Neutral / Flat";
                    badgeEl.classList.remove("badge-bullish", "badge-bearish");
                    badgeEl.classList.add("badge-flat");
                }
            }
        }

        if (gapCommentEl) gapCommentEl.textContent = comment;
        if (resultBox) resultBox.classList.remove("hidden");
    }

    function updateFxLabels() {
        const pair = document.getElementById("fxPair")?.value;
        const nightLabel = document.getElementById("nightLabel");
        const morningLabel = document.getElementById("morningLabel");
        const mcxLabel = document.getElementById("mcxLabel");
        const impactInput = document.getElementById("impactFactor");

        if (!pair) return;

        // Auto-set impact factor based on pair (you said you only use Gold & Silver)
        if (impactInput) {
            if (pair === "XAUUSD") {
                impactInput.value = "50";   // Gold
            } else {
                impactInput.value = "1000"; // Silver
            }
            impactInput.readOnly = true;
        }

        if (pair === "XAUUSD") {
            if (nightLabel) nightLabel.textContent = "XAU/USD 11:45 PM Close";
            if (morningLabel) morningLabel.textContent = "XAU/USD 8:30 AM Price";
            if (mcxLabel) mcxLabel.textContent = "MCX Gold Previous Close (₹)";
        } else {
            if (nightLabel) nightLabel.textContent = "XAG/USD 11:45 PM Close";
            if (morningLabel) morningLabel.textContent = "XAG/USD 8:30 AM Price";
            if (mcxLabel) mcxLabel.textContent = "MCX Silver Previous Close (₹)";
        }
    }

    function loadGapHistory() {
        try {
            const raw = localStorage.getItem(GAP_HISTORY_KEY);
            if (!raw) return [];
            const parsed = JSON.parse(raw);
            return Array.isArray(parsed) ? parsed : [];
        } catch (err) {
            console.warn("Error loading FX → MCX gap history:", err);
            return [];
        }
    }

    function saveGapHistoryArray(arr) {
        try {
            localStorage.setItem(GAP_HISTORY_KEY, JSON.stringify(arr || []));
        } catch (err) {
            console.warn("Error saving FX → MCX gap history:", err);
        }
    }

    function updateGapSummary() {
        const history = loadGapHistory();
        const countEl = document.getElementById("gapSummaryCount");
        const avgErrEl = document.getElementById("gapSummaryAvgError");
        const hitRateEl = document.getElementById("gapSummaryHitRate");

        if (!countEl || !avgErrEl || !hitRateEl) return;

        const n = history.length;
        countEl.textContent = String(n);

        if (!n) {
            avgErrEl.textContent = "0";
            hitRateEl.textContent = "0%";
            return;
        }

        let sumAbsErr = 0;
        let hit = 0;
        let considered = 0;

        history.forEach(row => {
            const estGap = Number(document.getElementById("mcxGap")?.textContent);
                typeof row.estGap === "number" ? row.estGap : parseFloat(row.estGap);
            const actualGap =
                typeof row.actualGap === "number" ? row.actualGap : parseFloat(row.actualGap);

            if (!Number.isNaN(estGap) && !Number.isNaN(actualGap)) {
                const err = Math.abs(actualGap - estGap);
                sumAbsErr += err;
                considered++;

                if (estGap === 0 || actualGap === 0) {
                    if (estGap === actualGap) hit++;
                } else if (
                    (estGap > 0 && actualGap > 0) ||
                    (estGap < 0 && actualGap < 0)
                ) {
                    hit++;
                }
            }
        });

        const avgErr = considered ? sumAbsErr / considered : 0;
        const hitRate = considered ? (hit / considered) * 100 : 0;

        avgErrEl.textContent = avgErr.toFixed(1);
        hitRateEl.textContent = hitRate.toFixed(1) + "%";
    }

    function renderGapHistoryTable() {
        const tbody = document.getElementById("gapHistoryBody");
        if (!tbody) return;

        const history = loadGapHistory();
        tbody.innerHTML = "";

        history.forEach((row, index) => {
            const tr = document.createElement("tr");

            const cells = [
    row.date,
    row.pair,
    row.fxNight?.toFixed ? row.fxNight.toFixed(2) : row.fxNight,
    row.fxMorning?.toFixed ? row.fxMorning.toFixed(2) : row.fxMorning,
    row.fxMovePoints?.toFixed ? row.fxMovePoints.toFixed(3) : row.fxMovePoints,
    (typeof row.fxMovePercent === "number"
        ? row.fxMovePercent.toFixed(3)
        : row.fxMovePercent) + " %",
    row.mcxPrevClose?.toFixed ? row.mcxPrevClose.toFixed(1) : row.mcxPrevClose,
    row.estGap?.toFixed ? row.estGap.toFixed(1) : row.estGap,
    row.estOpen?.toFixed ? row.estOpen.toFixed(1) : row.estOpen,
    row.actualOpen == null ? "-" : (row.actualOpen.toFixed ? row.actualOpen.toFixed(1) : row.actualOpen),
    row.actualGap == null ? "-" : (row.actualGap.toFixed ? row.actualGap.toFixed(1) : row.actualGap),
    (row.position || "none").toUpperCase(),
    row.marketView || "Sideways",
    row.notes || ""
];


           cells.forEach((val, cellIndex) => {
    const td = document.createElement("td");

    if (cellIndex === 12) {
        const span = document.createElement("span");
        const label = (val || "").toString();
        span.textContent = label;
        span.classList.add("gap-view-pill");
        if (label.includes("Bull")) span.classList.add("gap-view-bullish");
        if (label.includes("Bear")) span.classList.add("gap-view-bearish");
        if (label.includes("Side")) span.classList.add("gap-view-sideways");
        td.appendChild(span);
    } else {
        td.textContent = val == null ? "" : String(val);
    }

    tr.appendChild(td);
});


            const actionTd = document.createElement("td");
            const delBtn = document.createElement("button");
            delBtn.className = "gap-history-delete-btn";
            delBtn.textContent = "✕";
            delBtn.title = "Delete row";
            delBtn.addEventListener("click", () => deleteGapHistoryRow(index));
            actionTd.appendChild(delBtn);
            tr.appendChild(actionTd);

            tbody.appendChild(tr);
        });

        updateGapSummary();
    }

    function saveCurrentGapToHistory() {
        const pair = document.getElementById("fxPair")?.value;
        const fxNight = parseFloat(document.getElementById("fxNightClose")?.value);
        const fxMorning = parseFloat(document.getElementById("fxMorning")?.value);
        const mcxPrevClose = parseFloat(document.getElementById("mcxPrevClose")?.value);
        const impactFactor = parseFloat(document.getElementById("impactFactor")?.value);

        const fxMovePointsText = document.getElementById("fxMovePoints")?.textContent || "";
        const fxMovePercentText =
            document.getElementById("fxMovePercent")?.textContent || "";
        const estGapText = document.getElementById("mcxGap")?.textContent || "";
        const estOpenText =
            document.getElementById("mcxEstimatedOpen")?.textContent || "";

        if (
            !pair ||
            Number.isNaN(fxNight) ||
            Number.isNaN(fxMorning) ||
            Number.isNaN(mcxPrevClose) ||
            Number.isNaN(impactFactor) ||
            !fxMovePointsText ||
            !estGapText ||
            !estOpenText ||
            fxMovePointsText === "-"
        ) {
            if (typeof showToast === "function") {
                showToast("Run Calculate Expected Gap with valid values before saving to history.", "danger");
            }
            return;
        }

        const fxMovePoints = parseFloat(fxMovePointsText);
        const fxMovePercent = parseFloat(fxMovePercentText);
        const estGap = Number(document.getElementById("mcxGap")?.textContent);
        const estOpen = Number(document.getElementById("mcxEstimatedOpen")?.textContent);

        const actualOpen = parseFloat(document.getElementById("mcxActualOpen")?.value);
        const position = document.getElementById("positionType")?.value || "none";
        const notes = (document.getElementById("gapNotes")?.value || "").trim();
        const dateStr = document.getElementById("fxGapDate")?.value || new Date().toISOString().slice(0, 10);


        const actualGap =
            Number.isNaN(actualOpen) || Number.isNaN(mcxPrevClose)
                ? null
                : actualOpen - mcxPrevClose;

       const history = loadGapHistory();
const marketView =
    fxMovePoints > 0 ? "Bullish" :
    fxMovePoints < 0 ? "Bearish" :
    "Sideways";

history.unshift({
    date: dateStr,
    pair,
    fxNight,
    fxMorning,
    fxMovePoints,
    fxMovePercent,
    mcxPrevClose,
    estGap,
    estOpen,
    actualOpen: Number.isNaN(actualOpen) ? null : actualOpen,
    actualGap: actualGap,
    position,
    marketView,
    notes
});




        saveGapHistoryArray(history);
        renderGapHistoryTable();
    }

    function deleteGapHistoryRow(index) {
        const history = loadGapHistory();
        history.splice(index, 1);
        saveGapHistoryArray(history);
        renderGapHistoryTable();
    }

    // password modal helpers
	
	
	
	// ---------- SAFE CONFIRM HELPER ----------
window.confirmAction = function (message, onConfirm) {
  if (typeof openPasswordModal === "function") {
    openPasswordModal(message, onConfirm);
  } else {
    if (confirm(message)) onConfirm();
  }
};
	
    let fxGapModalCallback = null;

    function openFxGapPasswordModal(message, onSuccess) {
        fxGapModalCallback = onSuccess || null;

        const overlay = document.getElementById("fxGapPasswordOverlay");
        const msgEl   = document.getElementById("fxGapPasswordMessage");
        const input   = document.getElementById("fxGapPasswordInput");
        const errEl   = document.getElementById("fxGapPasswordError");

        if (!overlay || !msgEl || !input || !errEl) return;

        msgEl.textContent = message || "Enter password to confirm.";
        input.value = "";
        errEl.classList.add("hidden");
        overlay.classList.remove("hidden");
        input.focus();
    }

    function closeFxGapPasswordModal() {
        const overlay = document.getElementById("fxGapPasswordOverlay");
        if (overlay) overlay.classList.add("hidden");
        fxGapModalCallback = null;
    }

    function setupFxGapPasswordModal() {
        const overlay = document.getElementById("fxGapPasswordOverlay");
        const cancelBtn = document.getElementById("fxGapPasswordCancel");
        const confirmBtn = document.getElementById("fxGapPasswordConfirm");
        const input = document.getElementById("fxGapPasswordInput");
        const errEl = document.getElementById("fxGapPasswordError");

        if (!overlay || !cancelBtn || !confirmBtn || !input || !errEl) return;

        cancelBtn.addEventListener("click", () => {
            closeFxGapPasswordModal();
        });

        overlay.addEventListener("click", (e) => {
            if (e.target === overlay) {
                closeFxGapPasswordModal();
            }
        });

        function handleConfirm() {
            const val = input.value.trim();
            if (val !== FX_GAP_CLEAR_PASSWORD) {
                errEl.classList.remove("hidden");
                if (typeof showToast === "function") {
                    showToast("Incorrect password.", "danger");
                }
                return;
            }
            closeFxGapPasswordModal();
            if (typeof fxGapModalCallback === "function") {
                fxGapModalCallback();
            }
        }

        confirmBtn.addEventListener("click", handleConfirm);
        input.addEventListener("keydown", (e) => {
            if (e.key === "Enter") handleConfirm();
        });
    }

    function clearGapHistory() {
        openPasswordModal("delete FX → MCX gap history", function () {
            saveGapHistoryArray([]);
            renderGapHistoryTable();
            if (typeof updateGapSummary === "function") {
                updateGapSummary();
            }
            if (typeof showToast === "function") {
                showToast("FX → MCX gap history cleared.", "success");
            }
        });
    }
	
	
	
	window.addEventListener("app:reset", () => {
  saveGapHistoryArray([]);
  renderGapHistoryTable();
  if (typeof updateGapSummary === "function") {
    updateGapSummary();
  }
});

    function setupFxMcxGapMapper() {
        const calcBtn = document.getElementById("calcGapBtn");
        const fxPairSelect = document.getElementById("fxPair");
        const saveBtn = document.getElementById("saveGapHistoryBtn");
        const clearBtn = document.getElementById("clearGapHistoryBtn");

        if (calcBtn) calcBtn.addEventListener("click", calculateFxToMcxGap);
        if (fxPairSelect) {
            fxPairSelect.addEventListener("change", updateFxLabels);
            updateFxLabels();
        }
        if (saveBtn) saveBtn.addEventListener("click", saveCurrentGapToHistory);
        if (clearBtn) clearBtn.addEventListener("click", clearGapHistory);

        renderGapHistoryTable();
    }



/* === Soft slide helpers: add .sidebar-transitioning while animating === */
(function softSidebarTransitionHelpers() {
    const SIDEBAR_SELECTOR = '.glass-sidebar';
    const sidebar = document.querySelector(SIDEBAR_SELECTOR);
    if (!sidebar) return;

    function onTransitionStart() {
        document.body.classList.add('sidebar-transitioning');
    }
    function onTransitionEnd(e) {
        // only listen for width or transform transitions originating from sidebar
        if (e.target !== sidebar) return;
        document.body.classList.remove('sidebar-transitioning');
    }

    // attach listeners idempotently
    if (!sidebar.__softTransitionBound) {
        sidebar.addEventListener('transitionstart', onTransitionStart);
        sidebar.addEventListener('transitionend', onTransitionEnd);
        sidebar.__softTransitionBound = true;
    }

    // utility: when toggling collapse/open via window.toggleSidebarCollapsed(), ensure transitions run smoothly
    const orig = window.toggleSidebarCollapsed;
    window.toggleSidebarCollapsed = function(force) {
        // call original if present
        if (typeof orig === 'function') orig(force);
        // ensure the browser has queued the class change before adding transitioning flag
        requestAnimationFrame(() => {
            // the transitionstart listener will add/remove the class; force reflow to guarantee it runs
            // but also safe-guard: add class briefly if transition events don't fire
            if (!document.body.classList.contains('sidebar-transitioning')) {
                document.body.classList.add('sidebar-transitioning');
                setTimeout(() => {
                    document.body.classList.remove('sidebar-transitioning');
                }, 600); // slightly longer than CSS duration
            }
        });
    };
})();


// --- Sidebar visibility fix added automatically ---
// Ensure the sidebar is visible on initial load (desktop) and reset collapsed flag.
document.addEventListener('DOMContentLoaded', function () {
  try {
    if ((window.innerWidth || document.documentElement.clientWidth) >= 992) {
      document.body.classList.remove('sidebar-collapsed');
      document.body.classList.add('sidebar-open');
      try { localStorage.setItem('cj_sidebar_collapsed', '0'); } catch(e) {}
    }
  } catch (e) {
    // ignore
  }
});
// --- End fix ---



// === Trades table sorting (click header to sort) ===





/* Non-invasive sortable headers for #tradesTable
   - runs in isolated IIFE, uses no global names,
   - attaches to headers with [data-type] and toggles sort on click/keyboard.
*/
(function(){
  function safeParseNumber(s){
    if(s === undefined || s === null) return -Infinity;
    var cleaned = String(s).replace(/[,+₹\s]/g,'').replace(/[^0-9.\-]/g,'');
    var n = parseFloat(cleaned);
    return isNaN(n) ? -Infinity : n;
  }
  function safeParseDate(s){
    var t = Date.parse(String(s));
    return isNaN(t) ? 0 : t;
  }
  function parseCell(text, type){
    if(type === 'number') return safeParseNumber(text);
    if(type === 'date') return safeParseDate(text);
    return String(text).toLowerCase();
  }

  function initSortableTable(table){
    if(!table) return;
    var thead = table.tHead;
    if(!thead) return;
    var tbody = table.tBodies && table.tBodies[0];
    if(!tbody) return;
    var headers = Array.prototype.slice.call(thead.querySelectorAll('th'));
    var state = {index:-1, asc:true};

    function updateIndicators(activeIdx, asc){
      headers.forEach(function(th, i){
        var ind = th.querySelector('.sort-indicator');
        if(!ind) return;
        if(i === activeIdx){
          ind.textContent = asc ? '▲' : '▼';
          ind.style.opacity = 1;
          th.classList && th.classList.add('sorted');
        } else {
          ind.textContent = '↕';
          ind.style.opacity = 0.5;
          th.classList && th.classList.remove('sorted');
        }
      });
    }

    function sortByColumn(colIndex, type, asc){
      var rows = Array.prototype.slice.call(tbody.rows);
      var mapped = rows.map(function(row, idx){
        var cell = row.cells[colIndex];
        var txt = cell ? cell.textContent.trim() : '';
        return {idx: idx, row: row, key: parseCell(txt, type)};
      });
      mapped.sort(function(a,b){
        if(a.key === b.key) return a.idx - b.idx;
        return (a.key < b.key) ? (asc ? -1 : 1) : (asc ? 1 : -1);
      });
      var frag = document.createDocumentFragment();
      mapped.forEach(function(m){ frag.appendChild(m.row); });
      tbody.appendChild(frag);
      state.index = colIndex; state.asc = asc;
      updateIndicators(colIndex, asc);
    }

    headers.forEach(function(th, i){
      var type = th.getAttribute('data-type');
      if(!type) { th.style.cursor = 'default'; return; }
      th.tabIndex = 0;
      th.addEventListener('click', function(){
        var same = state.index === i;
        var asc = same ? !state.asc : true;
        sortByColumn(i, type, asc);
      });
      th.addEventListener('keydown', function(e){
        if(e.key === 'Enter' || e.key === ' '){ e.preventDefault(); th.click(); }
      });
    });

    // Observe tbody changes and reapply sort when rows change
    try {
      var mo = new MutationObserver(function(mutations){
        if(state.index === -1) return;
        // prevent re-entrancy by disconnecting while we sort
        try{ mo.disconnect(); }catch(e){}
        var th = headers[state.index];
        var type = th ? th.getAttribute('data-type') : 'string';
        sortByColumn(state.index, type, state.asc);
        // reconnect after a short delay to avoid immediate retrigger from our own DOM moves
        setTimeout(function(){ try{ mo.observe(tbody, { childList: true }); }catch(e){} }, 30);
      });
      mo.observe(tbody, { childList: true });
    } catch(e){}
  }

  function initAll(){
    try {
      ['tradesTable','snapshotTable','dwTable'].forEach(function(id){
        var table = document.getElementById(id);
        if(table) initSortableTable(table);
      });
    } catch(e){}
  }

  if(document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', initAll);
  } else {
    setTimeout(initAll, 0);
  }
})();



/* === PATCH ADDED: set sticky header top to avoid overlap with filter area === */
(function() {
  function adjustTradesHeaderOffset() {
    try {
      var topBar = document.querySelector('#section-trades .card-header-row, #section-trades .extra-filters-row, #section-trades .filter-group');
      var offset = 0;
      if (topBar) {
        // compute offset relative to viewport top including margins
        var rect = topBar.getBoundingClientRect();
        // We need the distance from the top of the page to the top of the #section-trades container header
        // Use offsetHeight as a safe estimate
        offset = topBar.offsetHeight || Math.round(rect.height) || 0;
        // add small cushion
        offset += 6;
      }
      var ths = document.querySelectorAll('#tradesTable thead th');
      ths.forEach(function(th) {
        th.style.top = offset + 'px';
      });
    } catch (e) {
      // ignore
      console.error('adjustTradesHeaderOffset error', e);
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function() {
      adjustTradesHeaderOffset();
      window.addEventListener('resize', adjustTradesHeaderOffset);
      // small delay for late layout changes
      setTimeout(adjustTradesHeaderOffset, 500);
    });
  } else {
    adjustTradesHeaderOffset();
    window.addEventListener('resize', adjustTradesHeaderOffset);
    setTimeout(adjustTradesHeaderOffset, 500);
  }
})();
/* === END PATCH === */


function getValidMarketOCEntries() {
  const snaps = getSnapshots();
  return snaps.filter(s =>
    Number.isFinite(Number(s.open)) &&
    Number.isFinite(Number(s.close))
  );
}

function resolveExpectedMoveSourceUI() {
  const label = document.getElementById("expectedMoveSourceText");
  if (!label) return;

  const validOC = getValidMarketOCEntries();

  if (validOC.length >= 10) {
    label.textContent =
      "Source: Trades Table (Auto – Market Open & Close)";
    return "SNAPSHOT";
  } else {
    label.textContent =
      "Source: Upload Monthly JSON required (min 10 Market Open & Close)";
    return "JSON_REQUIRED";
  }
}


// Removed custom wheel inertia scroll to avoid nested scroll issues.




document.addEventListener("DOMContentLoaded", function () {
    try {
        if (typeof setupFxMcxGapMapper === "function") {
            setupFxMcxGapMapper();
        }
        if (typeof setupFxGapPasswordModal === "function") {
            setupFxGapPasswordModal();
        }
    } catch (e) {
        console.warn("FX → MCX init error", e);
    }
});


/* ===== FX → MCX Gap History delete (SAME as Market Open & Close) ===== */
function deleteFxMcxHistory(index) {
  openPasswordModal(() => {
    const history = loadGapHistory();
    history.splice(index, 1);
    saveGapHistory(history);
    renderGapHistoryTable();
  });
}


// ===== Income filter (Profit / Loss) =====
(function () {
  const incomeEl = document.getElementById("tradeFilterIncome");
  if (!incomeEl) return;

  incomeEl.addEventListener("change", () => {
    tradeFilterState.income = incomeEl.value || "all";
    renderTradesTable();
  });
})();


// ===== Trades Full Preview Popup =====
// ===== Trades Full Preview Popup (SAFE) =====
// OLD Trades popup disabled


/* ===============================
   Trades Full Preview – FULL SECTION POPUP
   Safe DOM-move approach (no logic duplication)
================================ */




/* ===============================
   Trades – FULL SECTION popup
   macOS spring + fullscreen
================================ */
(function () {
  const openBtn =
    document.getElementById("openTradesPreviewIcon") ||
    document.getElementById("tradesFullPreviewBtn");

  const backdrop =
    document.getElementById("tradesPopupBackdrop") ||
    document.getElementById("tradesPreviewBackdrop");

  const popup = backdrop ? backdrop.querySelector(".mac-popup") : null;

  const popupMount =
    document.getElementById("tradesPopupMount") ||
    document.getElementById("tradesPopupContent");

  const closeBtn =
    document.getElementById("tradesPopupCloseBtn") ||
    document.getElementById("tradesPopupClose") ||
    document.getElementById("tradesPopupCloseRight");

  const greenDot = popup ? popup.querySelector(".mac-dot.mac-fullscreen") : null;
  const tradesSection = document.getElementById("section-trades");

  if (!openBtn || !tradesSection) {
  // Trades popup not available on this page – safely skip
  return;
}

  const placeholder = document.createElement("div");
  placeholder.style.display = "none";

  function openPopup() {
    if (!placeholder.parentNode) {
      tradesSection.parentNode.insertBefore(placeholder, tradesSection);
    }
    popupMount.innerHTML = "";
    popupMount.appendChild(tradesSection);

    backdrop.classList.add("show");
    popup.classList.remove("trades-popup-exit");
    popup.classList.add("trades-popup-spring");
    document.body.style.overflow = "hidden";
  }

  function closePopup() {
    popup.classList.remove("trades-popup-spring");
    popup.classList.add("trades-popup-exit");

    setTimeout(() => {
      if (placeholder.parentNode) {
        placeholder.parentNode.insertBefore(tradesSection, placeholder);
      }
      backdrop.classList.remove("show");
      popup.classList.remove("trades-popup-exit", "fullscreen");
      document.body.style.overflow = "";
    }, 220);
  }

  function toggleFullscreen() {
    popup.classList.toggle("fullscreen");
  }

  openBtn.addEventListener("click", openPopup);
  if (closeBtn) closeBtn.addEventListener("click", closePopup);
  if (greenDot) greenDot.addEventListener("click", toggleFullscreen);

 // document.addEventListener("keydown", (e) => {
  //  if (e.key === "Escape" && backdrop.classList.contains("show")) {
  //    closePopup();
  //  }
  //});
  document.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && backdrop.classList.contains("show")) {
    closePopup();
  }
});
  // close only when clicking backdrop itself
backdrop.addEventListener("click", (e) => {
  if (e.target === backdrop) {
    closePopup();
  }
});
})();



// ===== Trades Full Preview Popup (SAFE CLONE VERSION) =====
let isTradesPopupOpen = false;

function openTradesPopup() {
  if (isTradesPopupOpen) return;

  const backdrop = document.getElementById("tradesPopupBackdrop");
  const popupContent = document.getElementById("tradesPopupContent");
  const tradesSection = document.getElementById("tradesDetailsSection");

  if (!backdrop || !popupContent || !tradesSection) return;

  popupContent.innerHTML = "";
  popupContent.appendChild(tradesSection.cloneNode(true));

  backdrop.classList.add("show");
  document.body.style.overflow = "hidden";
  isTradesPopupOpen = true;
}

function closeTradesPopup() {
  const backdrop = document.getElementById("tradesPopupBackdrop");
  if (!backdrop) return;

  backdrop.classList.remove("show");
  document.body.style.overflow = "";
  isTradesPopupOpen = false;
}

document.addEventListener("DOMContentLoaded", () => {
  document.getElementById("openTradesPreviewIcon")
    ?.addEventListener("click", openTradesPopup);

  document.getElementById("tradesPopupClose")
    ?.addEventListener("click", closeTradesPopup);

  document.addEventListener("keydown", e => {
    if (e.key === "Escape" && isTradesPopupOpen) closeTradesPopup();
  });
});

// === Commodity Direction Wiring ===
let tradeDirection = 'BUY';
const buyBtn = document.getElementById('commodityBuyBtn');
const sellBtn = document.getElementById('commoditySellBtn');
const targetEl = document.getElementById('commodityTarget');
const targetNoteEl = document.getElementById('commodityTargetNote');

function renderTarget(result){
  if(!result.target){
    targetEl.textContent = '—';
    if(result.explanation){
      targetNoteEl.textContent = result.explanation;
      targetNoteEl.style.display = 'block';
    }
  } else {
    targetEl.textContent = result.target;
    targetNoteEl.style.display = 'none';
  }
}

buyBtn && buyBtn.addEventListener('click',()=>{
  tradeDirection='BUY';
  buyBtn.classList.add('active');
  sellBtn.classList.remove('active');
  if (typeof recalcCommodity === "function") {
  recalcCommodity();
}
});
sellBtn && sellBtn.addEventListener('click',()=>{
  tradeDirection='SELL';
  sellBtn.classList.add('active');
  buyBtn.classList.remove('active');
  if (typeof recalcCommodity === "function") {
  recalcCommodity();
}
});


/* GLOBAL IMPACT RESET (patched to skip Commodity New Tools) */
document.addEventListener("input", (e) => {
  if (e.target.closest("#section-metals-news")) return;
  document.querySelectorAll(".impact-value").forEach(el => el.textContent = "—");
});


/* =========================================================
   FINAL SAFE FIX: Commodity Dropdown → Label Sync
   - NO calculation logic touched
   ========================================================= */
(function () {
  const commoditySelect = document.getElementById("commodityType");
  const lbl = document.getElementById("activeCommodityLabel");

  if (!commoditySelect || !lbl) return;

  // 🔴 THIS WAS MISSING (initial sync)
  lbl.textContent = commoditySelect.value;

 commoditySelect.onchange = function () {
  const selected = this.value;

  // update label
  lbl.textContent = selected;
  window.activeCommodity = selected;

  // 🔒 SAFE RESET (UI only)
  document.querySelectorAll(
    '#section-metals-news input[type="number"], #section-metals-news input[type="text"]'
  ).forEach(inp => inp.value = '');

  document.querySelectorAll(
    '#section-metals-news .impact-value'
  ).forEach(el => el.textContent = '0');

  console.log("Active commodity changed → reset inputs:", selected);

  // SAFE: re-run calc after reset
  setTimeout(() => { if (typeof calc === 'function') calc(); }, 0);
};
})();

// ===== Mobile Sidebar Toggle =====




// ===== FX SAVE-LAYER DATE FIX (FINAL) =====
// Ensures FX history ALWAYS uses selected calendar date
(function(){
  function fixLastFxHistoryDate(){
    const d = document.getElementById("fxGapDate");
    if (!d || !d.value) return;

    try {
      const key = Object.keys(localStorage).find(k => k.toLowerCase().includes("fx") && k.toLowerCase().includes("history"));
      if (!key) return;

      const arr = JSON.parse(localStorage.getItem(key) || "[]");
      if (!Array.isArray(arr) || arr.length === 0) return;

      arr[arr.length - 1].date = d.value;
      localStorage.setItem(key, JSON.stringify(arr));
    } catch(e){}
  }

  document.addEventListener("click", function(e){
    const btn = e.target.closest("button");
    if (!btn) return;
    if (btn.textContent && btn.textContent.includes("FX") && btn.textContent.includes("History")) {
      setTimeout(fixLastFxHistoryDate, 50);
    }
  });
})();
// ===== END FX SAVE-LAYER DATE FIX =====
// ===== FX → MCX default date =====
document.addEventListener("DOMContentLoaded", () => {
  const fxDate = document.getElementById("fxGapDate");
  if (fxDate && !fxDate.value) {
    fxDate.value = new Date().toISOString().slice(0, 10);
  }
});




function getFxMcxHistory() {
  return JSON.parse(localStorage.getItem("fx_mcx_gap_history") || "[]");
}

const trendBiasDateEl = document.getElementById("trendBiasDate");

if (trendBiasDateEl) {
  trendBiasDateEl.addEventListener("change", function () {
    const selectedDate = this.value;
    updateTrendSetupFromHistory(selectedDate);
  });
}
  
  function updateTrendSetupFromHistory(date) {
	  
	  // Normalize Trend Date (dd-mm-yyyy → yyyy-mm-dd)
  const normalizedDate = (() => {
    if (!date) return date;
    if (date.includes("-") && date.split("-")[0].length === 4) return date;
    const [dd, mm, yyyy] = date.split("-");
    return `${yyyy}-${mm}-${dd}`;
  })();
  
  const history = getFxMcxHistory();

  const row = history.find(r => r.date === normalizedDate);
  if (!row) {
    console.warn("No FX→MCX data for selected date");
    return;
  }

  // TEXT VALUES
  document.querySelector(".trend-fx-move").innerText =
    `${row.fxMove.toFixed(2)} pts`;

  document.querySelector(".trend-fx-percent").innerText =
    `${row.fxPercent.toFixed(2)}%`;

  document.querySelector(".trend-mcx-gap").innerText =
    `₹${Math.round(row.estGap).toLocaleString()}`;

  document.querySelector(".trend-mcx-open").innerText =
    `₹${Math.round(row.estOpen).toLocaleString()}`;

  // BIAS
  applyTrendBias(row.marketView);
}

function applyTrendBias(view) {
  const biasEl = document.querySelector(".trend-bias-text");

  biasEl.className = "trend-bias-text"; // reset

  if (view === "Bullish") {
    biasEl.innerText = "Strong Bullish";
    biasEl.classList.add("bullish");
  } else if (view === "Bearish") {
    biasEl.innerText = "Strong Bearish";
    biasEl.classList.add("bearish");
  } else {
    biasEl.innerText = "Sideways";
    biasEl.classList.add("neutral");
  }
}
document.addEventListener("DOMContentLoaded", () => {
  const trendDateInput = document.getElementById("trendBiasDate");
  if (!trendDateInput) return;

  // today in yyyy-mm-dd
  const today = new Date().toISOString().split("T")[0];

  trendDateInput.value = today;

  // auto-load trend setup for today
  updateTrendSetupFromHistory(today);
});

// ===============================
// Trend Bias – Default Today Load
// ===============================



function saveGapTable() {
  const rows = [];
  document.querySelectorAll("#gapHistoryBody tr").forEach(tr => {
    const row = [];
    tr.querySelectorAll("td").forEach(td => {
      row.push(td.innerText);
    });
    rows.push(row);
  });
  localStorage.setItem("gapTableBackup", JSON.stringify(rows));
}

function loadGapTable() {
  const data = JSON.parse(localStorage.getItem("gapTableBackup"));
  if (!data) return;

  const tbody = document.getElementById("gapHistoryBody");
  tbody.innerHTML = "";

  data.forEach(row => {
    const tr = document.createElement("tr");
    row.forEach(text => {
      const td = document.createElement("td");
      td.innerText = text;
      tr.appendChild(td);
    });
    tbody.appendChild(tr);
  });
}




