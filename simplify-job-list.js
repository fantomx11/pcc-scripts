javascript:!function() {
    // Helper function to copy text to clipboard
    function copyTextToClipboard(text) {
        // Use the modern navigator.clipboard API if available
        if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(text).then(() => {
                // Optional: Provide visual feedback (e.g., alert or temporary status message)
                console.log(`Copied Job Number: ${text}`);
            }).catch(err => {
                console.error("Could not copy text: ", err);
                fallbackCopyTextToClipboard(text);
            });
        } else {
            // Fallback for older browsers
            fallbackCopyTextToClipboard(text);
        }
    }

    // Fallback function for copying text
    function fallbackCopyTextToClipboard(text) {
        const textArea = document.createElement("textarea");
        textArea.value = text;
        textArea.style.position = "fixed";  // Avoid scrolling to bottom
        textArea.style.left = "-9999px";
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();
        try {
            const successful = document.execCommand("copy");
            const msg = successful ? "successful" : "unsuccessful";
            console.log("Fallback: Copying text command was " + msg);
        } catch (err) {
            console.error("Fallback: Oops, unable to copy", err);
        }
        document.body.removeChild(textArea);
    }

    // Helper function to create a table cell
    function createTableCell(cellData) {
        const td = document.createElement("td");
        // cellData.background is the flag class (e.g., 'flag-critical')
        cellData.background && td.classList.add(cellData.background);
        td.style.padding = "8px 4px";
        
        // Add a class for specific column styling if needed
        cellData.className && td.classList.add(cellData.className);
        
        let contentContainer = td;

        // Create a wrapper div to contain content and ensure padding is applied correctly
        const wrapper = document.createElement("div");
        wrapper.style.display = "flex";
        wrapper.style.alignItems = "center";
        wrapper.style.justifyContent = "space-between"; // Ensure content and potential button are spaced

        // If a URL exists, make the content an anchor tag or use the wrapper for general content
        cellData.color && (wrapper.style.color = cellData.color);

        if (cellData.url) {
            contentContainer = document.createElement("a");
            contentContainer.href = cellData.url;
            contentContainer.target = "_blank";
            wrapper.appendChild(contentContainer);
        } else if (cellData.isButton) {
            // If it's a button cell, create the button element
            const button = document.createElement("button");
            button.innerText = cellData.text;
            button.style.cursor = "pointer";
            button.style.padding = "2px 6px";
            button.style.border = "1px solid #ccc";
            button.style.borderRadius = "3px";
            button.style.fontSize = "small";
            button.setAttribute("data-copy-text", cellData.copyText); // Store text to copy
            contentContainer = button;
            
            // Attach the click event handler for the copy function
            button.addEventListener('click', (e) => {
                e.stopPropagation(); // Prevent the row click event from firing
                copyTextToClipboard(cellData.copyText);
                // Optional: Simple visual confirmation
                button.innerText = "Copied!";
                setTimeout(() => {
                    button.innerText = cellData.text; // Restore button text
                }, 1000);
            });
            wrapper.appendChild(contentContainer);

        } else {
            // For regular text content
            contentContainer = wrapper;
        }
        
        // Set the text content (either to the <a> or the wrapper <div>)
        if (!cellData.isButton) {
            contentContainer.innerText = cellData.text;
        }

        td.appendChild(wrapper);
        return td
    }

    // Helper function to parse a currency string to a float
    function parseCurrency(text) {
        return text ? parseFloat(text.replace(/[^0-9.-]+/g, "")) : 0
    }

    // Constants for CSS classes
    const CRITICAL_FLAG_CLASS = "flag-critical",
        WARNING_FLAG_CLASS = "flag-warning",

        // List of columns checked for validation/flagging
        VALIDATION_COLUMNS = ["Job Status", "Total Estimates", "Total Invoiced", "Total Collected", "Last Journal Note Event Date/Time"],

        // Find the header row
        headerRow = document.querySelector(".rgHeaderWrapper thead tr");

    if (!headerRow) return alert("Could not find the header row. Please check the page structure.");

    const headerCells = [...headerRow.querySelectorAll("th")],
        COL_INDEX = {
            jobNumber: headerCells.findIndex((cell => "Job Number" === cell.textContent.trim())),
            customer: headerCells.findIndex((cell => "Customer" === cell.textContent.trim())),
            estimator: headerCells.findIndex((cell => "Estimator" === cell.textContent.trim())),
            xactId: headerCells.findIndex((cell => "Xact TransactionID" === cell.textContent.trim())),
            supervisor: headerCells.findIndex((cell => "Supervisor" === cell.textContent.trim())),
            foreman: headerCells.findIndex((cell => "Foreman" === cell.textContent.trim())),
            jobStatus: headerCells.findIndex((cell => "Job Status" === cell.textContent.trim())),
            totalCollected: headerCells.findIndex((cell => "Total Collected" === cell.textContent.trim())),
            totalEstimates: headerCells.findIndex((cell => "Total Estimates" === cell.textContent.trim())),
            totalInvoiced: headerCells.findIndex((cell => "Total Invoiced" === cell.textContent.trim())),
            accountingPerson: headerCells.findIndex((cell => "Accounting Person" === cell.textContent.trim())),
            lastJournalNoteDate: headerCells.findIndex((cell => "Last Journal Note Event Date/Time" === cell.textContent.trim()))
        };

    // Check for required columns
    if ([COL_INDEX.jobNumber, COL_INDEX.customer, COL_INDEX.estimator, COL_INDEX.xactId].some((index => -1 === index)))
        return alert("Could not find one or more required columns (Job Number, Customer, Estimator, Xact TransactionID).");

    const {
        supervisor: supervisorIndex,
        foreman: foremanIndex,
        accountingPerson: accountingPersonIndex,
        jobStatus: jobStatusIndex,
        totalCollected: collectedIndex,
        totalEstimates: estimatesIndex,
        totalInvoiced: invoicedIndex,
        lastJournalNoteDate: journalDateIndex,
        xactId: xactIdIndex
    } = COL_INDEX;

    // Scrape data from each job row
    const scrapedJobs = [...document.querySelectorAll("tr.rgRow, tr.rgAltRow")].map((tableRow => function(tableRow, colIndexes) {
        const cells = tableRow.querySelectorAll("td"),
            estimatorName = (cells[colIndexes.estimator].textContent.trim() || "Unassigned").replace(":", ""),
            accountingPerson = (cells[colIndexes.accountingPerson].textContent.trim() || "Unassigned").replace(":", ""),
            supervisorName = -1 !== colIndexes.supervisor ? (cells[supervisorIndex].textContent.trim() || "Unassigned").replace(":", "") : "",
            foremanName = -1 !== colIndexes.foreman ? (cells[foremanIndex].textContent.trim() || "").replace(":", "") : "",
            // Use foreman name if present, otherwise use supervisor name
            assignedManager = "" === foremanName ? supervisorName : foremanName,
            jobNumberLinkElement = cells[colIndexes.jobNumber].querySelector("a"),
            jobNumberUrl = jobNumberLinkElement ? jobNumberLinkElement.href : "#",
            jobNumber = cells[colIndexes.jobNumber].textContent.trim(),
            customerName = cells[colIndexes.customer].textContent.trim();

        let jobStatus = -1 !== jobStatusIndex ? cells[jobStatusIndex].textContent.trim() : "",
            totalCollectedText = -1 !== collectedIndex ? cells[collectedIndex].textContent.trim() : "",
            totalInvoicedText = -1 !== invoicedIndex ? cells[invoicedIndex].textContent.trim() : "",
            totalEstimatesText = -1 !== estimatesIndex ? cells[estimatesIndex].textContent.trim() : "";
        const xactId = -1 !== xactIdIndex ? cells[xactIdIndex].textContent.trim() : "";
        let lastJournalDateText = -1 !== journalDateIndex ? cells[journalDateIndex].textContent.trim() : "";

        if (0 === jobNumber.length || 0 === customerName.length) return null;

        const otherColumns = {};
        let jobFlagLevel = 0; // 0=None, 1=Warning, 2=Critical
        const flaggedFields = {},

            // Validation function for Journal Date
            checkJournalDate = function(dateText) {
                if (!dateText || "" === dateText.trim()) return {
                    color: void 0,
                    flag: 0
                };
                const lastNoteDate = new Date(dateText),
                    today = new Date,
                    timeDifference = today - lastNoteDate,
                    daysDifference = Math.ceil(timeDifference / 864e5);
                return daysDifference > 14 ? {
                    color: CRITICAL_FLAG_CLASS,
                    flag: 2
                } : daysDifference > 7 ? {
                    color: WARNING_FLAG_CLASS,
                    flag: 1
                } : {
                    color: void 0,
                    flag: 0
                }
            }(lastJournalDateText);

        // Apply Journal Date flag
        if (checkJournalDate.flag > 0 && (jobFlagLevel = checkJournalDate.flag, flaggedFields["Last Journal Note Event Date/Time"] = checkJournalDate.color), -1 !== estimatesIndex && -1 !== invoicedIndex) {
            // Estimates vs Invoiced Check
            const estimatesValue = parseCurrency(totalEstimatesText),
                invoicedValue = parseCurrency(totalInvoicedText);
            Math.abs(estimatesValue - invoicedValue) > .01 && (jobFlagLevel = 2, flaggedFields["Total Estimates"] = CRITICAL_FLAG_CLASS, flaggedFields["Total Invoiced"] = CRITICAL_FLAG_CLASS)
        }
        if (-1 !== jobStatusIndex && -1 !== collectedIndex && -1 !== invoicedIndex) {
            // Collected vs Invoiced Check for Completed Jobs
            const invoicedValue = parseCurrency(totalInvoicedText),
                collectedValue = parseCurrency(totalCollectedText),
                isCompleted = "Waiting for Final Closure" === jobStatus || "Completed without Paperwork" === jobStatus,
                isCollectedMatch = Math.abs(collectedValue - invoicedValue) < .01;
            isCompleted && !isCollectedMatch && (jobFlagLevel = 2, flaggedFields["Job Status"] = CRITICAL_FLAG_CLASS, flaggedFields["Total Collected"] = CRITICAL_FLAG_CLASS, flaggedFields["Total Invoiced"] = CRITICAL_FLAG_CLASS)
        }

        // Collect data for other non-validated columns
        headerCells.forEach(((header, index) => {
            if (index > 1) {
                const columnName = header.textContent.trim(),
                    columnData = {
                        text: cells[index].textContent.trim()
                    };
                // Apply flag background if this column is one of the validated ones AND has a flag
                VALIDATION_COLUMNS.includes(columnName) && flaggedFields[columnName] && (columnData.background = flaggedFields[columnName]),
                    // Only include columns that aren't the primary ones we already extracted
                    VALIDATION_COLUMNS.includes(columnName) || "Job Number" === columnName || "Customer" === columnName || "Estimator" === columnName || "Xact TransactionID" === columnName || "Supervisor" === columnName || "Foreman" === columnName || (otherColumns[columnName] = columnData)
            }
        }));

        // Return the structured job object
        return {
            estimator: estimatorName,
            supervisor: supervisorName,
            foreman: assignedManager,
            accountingPerson: accountingPerson,
            flagged: jobFlagLevel,
            rowFlagClass: 1 === jobFlagLevel ? WARNING_FLAG_CLASS : 2 === jobFlagLevel ? CRITICAL_FLAG_CLASS : void 0,
            name: {
                text: customerName,
                background: void 0 // Will be set in the rendering function for the list view
            },
            dash: {
                text: jobNumber,
                url: jobNumberUrl,
                background: void 0 // Will be set in the rendering function for the list view
            },
            // NEW: Column for the Copy Button
            copyJobNumber: {
                text: "Copy",
                copyText: jobNumber, // The actual text to copy
                isButton: true,
                className: "copy-button-cell",
                background: void 0
            },
            xa: {
                text: xactId.length > 0 ? "XactAnalysis" : "",
                url: xactId.length > 0 ? `https://www.xactanalysis.com/apps/cxa/detail.jsp?mfn=${xactId}` : void 0,
                background: void 0 // Will be set in the rendering function for the list view
            },
            other: otherColumns,
            jobStatus: {
                text: jobStatus,
                background: flaggedFields["Job Status"]
            },
            totalCollected: {
                text: totalCollectedText,
                background: flaggedFields["Total Collected"]
            },
            estimates: {
                text: totalEstimatesText,
                background: flaggedFields["Total Estimates"]
            },
            invoiced: {
                text: totalInvoicedText,
                background: flaggedFields["Total Invoiced"]
            },
            journalDate: {
                text: lastJournalDateText,
                background: flaggedFields["Last Journal Note Event Date/Time"]
            }
        }
    }(tableRow, COL_INDEX))).filter(Boolean);

    // Store/append scraped data globally for multi-page processing
    window.scrapedData = window.scrapedData || [], window.scrapedData = window.scrapedData.concat(scrapedJobs);

    // Pagination check logic
    const paginationLinks = [...document.querySelectorAll(".rgNumPart a")],
        lastPageButton = paginationLinks[paginationLinks.length - 1],
        currentPageButton = document.querySelector(".rgNumPart .rgCurrentPage");

    // If a last page button exists and it's not the current page, click the next page button
    if (lastPageButton && currentPageButton && !lastPageButton.isSameNode(currentPageButton)) {
        const nextPageButton = currentPageButton.nextElementSibling;
        nextPageButton && nextPageButton.click()
    } else {
        // RENDER DASHBOARD (only runs after all pages have been scraped)
        !function renderDashboard(groupByKey) {
            const allJobs = window.scrapedData;
            let groupedJobs = {};

            // Group the jobs based on the selected key
            "none" === groupByKey ? groupedJobs["All Jobs"] = allJobs.map((({
                estimator: e,
                supervisor: s,
                foreman: f,
                ...data
            }) => data)) : groupedJobs = allJobs.reduce(((accumulator, jobData) => {
                const groupName = jobData[groupByKey], {
                    estimator: est,
                    supervisor: sup,
                    foreman: man,
                    ...rest
                } = jobData;
                return accumulator[groupName] = accumulator[groupName] || [], accumulator[groupName].push(rest), accumulator
            }), {});

            // Calculate flagged counts per group
            const flaggedCounts = {};
            let totalFlaggedCount = 0;
            for (const groupName in groupedJobs) {
                const flaggedInGroup = groupedJobs[groupName].filter((job => job.flagged > 0));
                flaggedInGroup.length > 0 && (flaggedCounts[groupName] = flaggedInGroup.length, totalFlaggedCount += flaggedInGroup.length)
            }

            // --- UI: FIXED CONTROLS (Top Right) ---
            const fixedControlsDiv = document.createElement("div");
            fixedControlsDiv.style.position = "fixed", fixedControlsDiv.style.top = "2em", fixedControlsDiv.style.right = "2em", fixedControlsDiv.style.zIndex = "10000", fixedControlsDiv.style.display = "flex", fixedControlsDiv.style.alignItems = "center", fixedControlsDiv.style.gap = "15px";

            // Grouping Buttons Container
            const groupingButtonsDiv = document.createElement("div");
            groupingButtonsDiv.style.padding = "5px 10px", groupingButtonsDiv.style.background = "#f5f5f5", groupingButtonsDiv.style.borderRadius = "5px", groupingButtonsDiv.style.display = "flex", groupingButtonsDiv.style.alignItems = "center", groupingButtonsDiv.style.boxShadow = "0 2px 4px rgba(0, 0, 0, 0.1)";

            const groupByLabel = document.createElement("span");
            groupByLabel.style.fontWeight = "bold", groupByLabel.style.marginRight = "10px", groupByLabel.innerText = "Group By:", groupingButtonsDiv.appendChild(groupByLabel);

            const groupKeyMap = {
                none: "None",
                estimator: "Estimator",
                supervisor: "Supervisor",
                foreman: "Foreman",
                accountingPerson: "Accountant"
            };

            // Create radio buttons for grouping
            ["none", "estimator", "supervisor", "foreman", "accountingPerson"].forEach((key => {
                // Skip if the column doesn't exist in the scraped table
                if ("none" !== key && -1 === COL_INDEX[key]) return;
                const label = document.createElement("label");
                label.style.marginRight = "10px", label.style.fontSize = "small", label.style.cursor = "pointer";
                const radioInput = document.createElement("input");
                radioInput.type = "radio", radioInput.name = "grouping", radioInput.value = key, radioInput.id = `group-${key}`,
                    key === groupByKey && (radioInput.checked = !0),
                    radioInput.addEventListener("change", (event => {
                        renderDashboard(event.target.value)
                    })), label.appendChild(radioInput), label.appendChild(document.createTextNode(groupKeyMap[key])), groupingButtonsDiv.appendChild(label)
            })), fixedControlsDiv.appendChild(groupingButtonsDiv);

            // Status Badge Button
            const statusBadgeButton = document.createElement("button");
            statusBadgeButton.style.backgroundColor = totalFlaggedCount > 0 ? "#dc3545" : "#6c757d", statusBadgeButton.style.color = "white", statusBadgeButton.style.border = "none", statusBadgeButton.style.borderRadius = "50%", statusBadgeButton.style.width = "40px", statusBadgeButton.style.height = "40px", statusBadgeButton.style.fontSize = "18px", statusBadgeButton.style.fontWeight = "bold", statusBadgeButton.style.cursor = "pointer", statusBadgeButton.innerText = totalFlaggedCount > 0 ? totalFlaggedCount : "✔";

            // Status Dropdown/Popup
            const statusDropdown = document.createElement("div");
            if (statusDropdown.style.position = "absolute", statusDropdown.style.right = "0", statusDropdown.style.top = "50px", statusDropdown.style.backgroundColor = "white", statusDropdown.style.border = "1px solid #ccc", statusDropdown.style.borderRadius = "5px", statusDropdown.style.boxShadow = "0 2px 10px rgba(0,0,0,0.1)", statusDropdown.style.padding = "10px", statusDropdown.style.display = "none", statusDropdown.style.width = "200px", totalFlaggedCount > 0)
                for (const groupName in flaggedCounts) {
                    const countParagraph = document.createElement("p");
                    countParagraph.style.margin = "5px 0", countParagraph.style.fontWeight = "bold", countParagraph.innerHTML = `${groupName}: <span style="color: #dc3545;">${flaggedCounts[groupName]} jobs</span>`, statusDropdown.appendChild(countParagraph)
                } else {
                    const noIssuesParagraph = document.createElement("p");
                    noIssuesParagraph.style.margin = "0", noIssuesParagraph.style.color = "#6c757d", noIssuesParagraph.innerText = "No outstanding issues!", statusDropdown.appendChild(noIssuesParagraph)
                }

            // Toggle dropdown on button click
            statusBadgeButton.addEventListener("click", (event => {
                statusDropdown.style.display = "none" === statusDropdown.style.display ? "block" : "none", event.stopPropagation()
            })),
            // Close dropdown on outside click
            document.addEventListener("click", (event => {
                fixedControlsDiv.contains(event.target) || (statusDropdown.style.display = "none")
            })), fixedControlsDiv.appendChild(statusBadgeButton), fixedControlsDiv.appendChild(statusDropdown);

            // --- UI: MAIN DASHBOARD CONTAINER ---
            const mainDashboardContainer = document.createElement("div");
            mainDashboardContainer.style.position = "fixed", mainDashboardContainer.style.top = "2em", mainDashboardContainer.style.left = "2em", mainDashboardContainer.style.right = "2em", mainDashboardContainer.style.bottom = "2em", mainDashboardContainer.style.padding = "20px", mainDashboardContainer.style.fontSize = "medium", mainDashboardContainer.style.background = "white", mainDashboardContainer.style.border = "1px solid #ccc", mainDashboardContainer.style.boxShadow = "0 4px 6px rgba(0, 0, 2, 0.1)", mainDashboardContainer.style.borderRadius = "8px", mainDashboardContainer.style.boxSizing = "border-box", mainDashboardContainer.style.display = "flex", mainDashboardContainer.style.flexDirection = "column", mainDashboardContainer.style.fontFamily = "Arial";

            // Tab Buttons Container
            const tabsContainer = document.createElement("div");
            tabsContainer.style.display = "flex", tabsContainer.style.borderBottom = "1px solid #ccc", tabsContainer.style.marginBottom = "10px", tabsContainer.style.overflowX = "auto", tabsContainer.style.whiteSpace = "nowrap", mainDashboardContainer.appendChild(tabsContainer);

            // Content Area (Lists + Details)
            const contentArea = document.createElement("div");
            contentArea.style.display = "flex", contentArea.style.flex = "1", contentArea.style.overflow = "hidden", contentArea.style.gap = "20px", mainDashboardContainer.appendChild(contentArea);

            // Job Lists Container (The scrollable lists of jobs)
            const jobListsContainer = document.createElement("div");
            jobListsContainer.style.display = "flex", jobListsContainer.style.gap = "20px", jobListsContainer.style.flex = "2 0 0%", jobListsContainer.style.overflow = "hidden", contentArea.appendChild(jobListsContainer);

            // Job Detail Panel
            const detailPanel = document.createElement("div");

            // Function to switch tabs
            function showTab(groupName) {
                [...jobListsContainer.children].forEach((element => element.style.display = "none")), [...tabsContainer.children].forEach((element => element.style.borderBottom = "none"));
                const contentDiv = document.getElementById(`tab-content-${groupName.replace(/\s+/g,"-")}`),
                    button = document.getElementById(`tab-button-${groupName.replace(/\s+/g,"-")}`);
                contentDiv && (contentDiv.style.display = "flex"), button && (button.style.borderBottom = "2px solid blue"), [...document.querySelectorAll("tr.selected-row")].forEach((row => row.classList.remove("selected-row"))), detailPanel.innerHTML = "<p>Select a job to view details.</p>"
            }

            // Function to show job details
            function showDetails(jobData, clickedRow) {
                const jobNumber = jobData.dash.text;
                // Clear existing selections and set new one
                [...document.querySelectorAll("tr.selected-row")].forEach((row => row.classList.remove("selected-row"))), document.querySelectorAll(`tr[data-job-number="${jobNumber}"]`).forEach((row => {
                    row.classList.add("selected-row")
                }));

                // Scroll the sister row in the other list into view
                const tabContentContainer = clickedRow.closest(".tab-content-container");
                if (tabContentContainer) {
                    const siblingListContainer = [...tabContentContainer.querySelectorAll("div")].find((container => !container.contains(clickedRow)));
                    if (siblingListContainer) {
                        const sisterRow = siblingListContainer.querySelector(`tr[data-job-number="${jobNumber}"]`);
                        sisterRow && sisterRow.scrollIntoView({
                            behavior: "smooth",
                            block: "nearest"
                        })
                    }
                }

                // Populate the detail panel
                detailPanel.innerHTML = "", [{
                    label: "Job Status",
                    data: jobData.jobStatus
                }, {
                    label: "Total Estimates",
                    data: jobData.estimates
                }, {
                    label: "Total Invoiced",
                    data: jobData.invoiced
                }, {
                    label: "Total Collected",
                    data: jobData.totalCollected
                }, {
                    label: "Last Journal Note Event Date/Time",
                    data: jobData.journalDate
                }].forEach((item => {
                    if (item.data.text.length > 0) {
                        const p = document.createElement("p");
                        p.innerHTML = `<strong>${item.label}:</strong> ${item.data.text}`, item.data.background && (p.classList.add(item.data.background), p.style.padding = "2px 5px", p.style.borderRadius = "3px"), detailPanel.appendChild(p)
                    }
                }));

                // Add other generic columns
                for (const columnName in jobData.other) {
                    const p = document.createElement("p");
                    p.innerHTML = `<strong>${columnName}:</strong> ${jobData.other[columnName].text}`, jobData.other[columnName].background && (p.classList.add(jobData.other[columnName].background), p.style.padding = "2px 5px", p.style.borderRadius = "3px"), detailPanel.appendChild(p)
                }
            }

            // Style and append detail panel
            detailPanel.style.flex = "1", detailPanel.style.overflowY = "auto", detailPanel.style.maxHeight = "100%", detailPanel.style.background = "#f5f5f5", detailPanel.style.padding = "10px", detailPanel.style.borderRadius = "5px", contentArea.appendChild(detailPanel);

            // --- UI: CUSTOM STYLES (CLEANED) ---
            const customStyles = document.createElement("style");
            customStyles.innerHTML = ".flag-critical { background-color: #f8d7da !important; /* Critical: light red/pink */ }\n.flag-warning { background-color: #fff3cd !important; /* Warning: light yellow */ }\n.selected-row { background-color: #d1e7ff !important; font-weight: bold !important; }\n.copy-button-cell { width: 50px; text-align: right; }",
                document.head.appendChild(customStyles);

            // --- UI: TABS AND LISTS ---
            const groupNames = Object.keys(groupedJobs).sort();

            groupNames.forEach((groupName => {
                // Tab Button
                const tabButton = document.createElement("button");
                tabButton.id = `tab-button-${groupName.replace(/\s+/g,"-")}`, tabButton.textContent = `${groupName}(${groupedJobs[groupName].length})`, tabButton.style.padding = "10px 15px", tabButton.style.cursor = "pointer", tabButton.style.border = "none", tabButton.style.background = "transparent", tabButton.style.fontSize = "1em", tabButton.style.marginRight = "5px", tabButton.addEventListener("click", (() => showTab(groupName))), tabsContainer.appendChild(tabButton);

                // Tab Content Container
                const tabContentContainer = document.createElement("div");
                tabContentContainer.id = `tab-content-${groupName.replace(/\s+/g,"-")}`, tabContentContainer.className = "tab-content-container", tabContentContainer.style.display = "none", tabContentContainer.style.flex = "1", tabContentContainer.style.display = "flex", tabContentContainer.style.gap = "20px";

                // List 1: Customer Name / Job Number / Copy Button
                const jobNumberListDiv = document.createElement("div");
                jobNumberListDiv.id = `list-jobnumber-${groupName.replace(/\s+/g,"-")}`, jobNumberListDiv.style.flex = "1", jobNumberListDiv.style.overflowY = "auto", jobNumberListDiv.style.maxHeight = "100%";
                const jobNumberTable = jobNumberListDiv.appendChild(document.createElement("table"));
                jobNumberTable.style.width = "100%", groupedJobs[groupName].forEach((job => {
                    const row = jobNumberTable.insertRow();
                    row.style.cursor = "pointer";
                    // Add selected row class to allow selection highlight to work
                    row.setAttribute("data-job-number", job.dash.text);

                    // FIXED: Pass the flag class to the createTableCell function so it lands on the <td>
                    job.name.background = job.rowFlagClass;
                    job.dash.background = job.rowFlagClass;
                    job.copyJobNumber.background = job.rowFlagClass; // Apply flag to the new column as well

                    row.appendChild(createTableCell(job.name));
                    row.appendChild(createTableCell(job.dash));
                    row.appendChild(createTableCell(job.copyJobNumber)); // NEW: Copy Button Column

                    row.addEventListener("click", (event => showDetails(job, event.currentTarget)));
                }));

                // List 2: XactAnalysis Link / Customer Name (Filtered by Xact ID existence)
                const xactAnalysisListDiv = document.createElement("div");
                xactAnalysisListDiv.id = `list-xactanalysis-${groupName.replace(/\s+/g,"-")}`, xactAnalysisListDiv.style.flex = "1", xactAnalysisListDiv.style.overflowY = "auto", xactAnalysisListDiv.style.maxHeight = "100%";
                const xactAnalysisTable = xactAnalysisListDiv.appendChild(document.createElement("table"));
                xactAnalysisTable.style.width = "100%", groupedJobs[groupName].filter((job => job.xa.text.length > 0)).forEach((job => {
                    const row = xactAnalysisTable.insertRow();
                    row.style.cursor = "pointer";
                    // Add selected row class to allow selection highlight to work
                    row.setAttribute("data-job-number", job.dash.text);

                    // FIXED: Pass the flag class to the createTableCell function so it lands on the <td>
                    job.name.background = job.rowFlagClass;
                    job.xa.background = job.rowFlagClass;

                    row.appendChild(createTableCell(job.name));
                    row.appendChild(createTableCell(job.xa));

                    row.addEventListener("click", (event => showDetails(job, event.currentTarget)));
                })), tabContentContainer.appendChild(jobNumberListDiv), tabContentContainer.appendChild(xactAnalysisListDiv), jobListsContainer.appendChild(tabContentContainer)
            }));

            // Clear the original page and insert the new UI
            document.body.innerHTML = "", document.body.appendChild(mainDashboardContainer), document.body.appendChild(fixedControlsDiv);

            // Select the initial tab (prioritizes "Sam Drost" or the first group)
            if (groupNames.length > 0) groupNames.includes("Sam Drost") ? showTab("Sam Drost") : showTab(groupNames[0]);
            else {
                const noDataParagraph = document.createElement("p");
                noDataParagraph.textContent = "No job data found. Please check the selectors!", jobListsContainer.appendChild(noDataParagraph)
            }
        }("estimator") // Initial grouping key is 'estimator'
    }
}();
