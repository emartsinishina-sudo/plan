(() => {
  "use strict";

  const STORAGE_KEY = "tasks_planner_db";
  const SCHEMA_VERSION = 1;

  const createEmptyDatabase = () => ({
    schemaVersion: SCHEMA_VERSION,
    tasks: [],
    recurrenceRules: []
  });

  const notificationRegion = document.querySelector("#notification-region");
  const storageErrorDialog = document.querySelector("#storage-error-dialog");
  const confirmResetButton = document.querySelector("#confirm-database-reset");
  const dateInput = document.querySelector("#planner-date");
  const weekStrip = document.querySelector("#week-strip");
  const taskForm = document.querySelector("#task-form");
  const taskFormPanel = document.querySelector("#task-form-panel");
  const openTaskDrawerButton = document.querySelector("#open-task-drawer");
  const closeTaskDrawerButton = document.querySelector("#close-task-drawer");
  const taskDrawerBackdrop = document.querySelector("#task-drawer-backdrop");
  const taskTitleInput = document.querySelector("#task-title");
  const taskDateInput = document.querySelector("#task-date");
  const taskTimeInput = document.querySelector("#task-time");
  const taskDurationInput = document.querySelector("#task-duration");
  const durationField = document.querySelector("#duration-field");
  const durationPresetButtons = document.querySelectorAll("[data-duration-preset]");
  const taskPriorityInput = document.querySelector("#task-priority");
  const taskClientTagInput = document.querySelector("#task-client-tag");
  const taskRecurrenceInput = document.querySelector("#task-recurrence");
  const taskRecurrenceWeekdayInput = document.querySelector("#task-recurrence-weekday");
  const weekdayField = document.querySelector("#weekday-field");
  const taskList = document.querySelector("#task-list");
  const taskTotal = document.querySelector("#task-total");
  const taskListContext = document.querySelector("#task-list-context");
  const taskListTitle = document.querySelector("#task-list-title");
  const statusFilter = document.querySelector("#status-filter");
  const priorityFilter = document.querySelector("#priority-filter");
  const clientFilter = document.querySelector("#client-filter");
  const completedSection = document.querySelector("#completed-section");
  const completedTaskList = document.querySelector("#completed-task-list");
  const completedTotal = document.querySelector("#completed-total");
  const taskListPanel = document.querySelector(".task-list-panel");
  const taskFormModeLabel = document.querySelector("#task-form-mode-label");
  const taskFormTitle = document.querySelector("#task-form-title");
  const taskSubmitButton = document.querySelector("#task-submit-button");
  const cancelEditButton = document.querySelector("#cancel-edit-button");
  const editScopeDialog = document.querySelector("#edit-scope-dialog");
  const editSingleInstanceButton = document.querySelector("#edit-single-instance");
  const editEntireSeriesButton = document.querySelector("#edit-entire-series");
  const stopSeriesDialog = document.querySelector("#stop-series-dialog");
  const stopSeriesKeepButton = document.querySelector("#stop-series-keep");
  const stopSeriesDeleteButton = document.querySelector("#stop-series-delete");
  const moveTaskDialog = document.querySelector("#move-task-dialog");
  const moveTargetDate = document.querySelector("#move-target-date");
  const moveTaskTimeInput = document.querySelector("#move-task-time");
  const moveTaskDuration = document.querySelector("#move-task-duration");
  const occupiedIntervals = document.querySelector("#occupied-intervals");
  const moveConflictWarning = document.querySelector("#move-conflict-warning");
  const confirmTaskMoveButton = document.querySelector("#confirm-task-move");
  const reportWeekLabel = document.querySelector("#report-week-label");
  const previousReportWeekButton = document.querySelector("#previous-report-week");
  const nextReportWeekButton = document.querySelector("#next-report-week");
  const exportDatabaseButton = document.querySelector("#export-database");
  const metricPlanned = document.querySelector("#metric-planned");
  const metricCompleted = document.querySelector("#metric-completed");
  const metricOverdue = document.querySelector("#metric-overdue");
  const metricCompletionRate = document.querySelector("#metric-completion-rate");
  const reportChart = document.querySelector("#report-chart");
  const weekdayFormatter = new Intl.DateTimeFormat("ru-RU", { weekday: "short" });
  const fullDateFormatter = new Intl.DateTimeFormat("ru-RU", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric"
  });
  const completionFormatter = new Intl.DateTimeFormat("ru-RU", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  });
  const reportRangeFormatter = new Intl.DateTimeFormat("ru-RU", {
    day: "numeric",
    month: "long",
    year: "numeric"
  });
  const chartDayFormatter = new Intl.DateTimeFormat("ru-RU", {
    weekday: "short"
  });
  let selectedDate = startOfDay(new Date());
  let database;
  let storageHasParseError = false;
  let editingTaskId = null;
  let editingMode = "single";
  let editingRuleId = null;
  let editingOccurrenceDate = null;
  let pendingEditTaskId = null;
  let pendingStopRuleId = null;
  let draggedTaskId = null;
  let pendingMoveTaskId = null;
  let pendingMoveTargetDate = null;
  let reportWeekStart = getMonday(new Date());
  const SVG_NAMESPACE = "http://www.w3.org/2000/svg";
  const filters = {
    status: "active",
    priority: "all",
    client: "all"
  };

  const priorityDetails = {
    high: { label: "Высокий", icon: "▲", rank: 0 },
    medium: { label: "Средний", icon: "◆", rank: 1 },
    low: { label: "Низкий", icon: "●", rank: 2 }
  };

  function startOfDay(date) {
    return new Date(date.getFullYear(), date.getMonth(), date.getDate());
  }

  function getMonday(date) {
    const result = startOfDay(date);
    const daysSinceMonday = (result.getDay() + 6) % 7;
    result.setDate(result.getDate() - daysSinceMonday);
    return result;
  }

  function addDays(date, numberOfDays) {
    const result = new Date(date);
    result.setDate(result.getDate() + numberOfDays);
    return startOfDay(result);
  }

  function formatDateValue(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  }

  function parseDateValue(value) {
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
    if (!match) {
      return null;
    }

    const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
    return Number.isNaN(date.getTime()) ? null : startOfDay(date);
  }

  function getTaskCount(dateValue) {
    if (!database || !Array.isArray(database.tasks)) {
      return 0;
    }
    return database.tasks.filter((task) => task.date === dateValue && !task.isCompleted).length;
  }

  function formatTaskCount(count) {
    const lastTwoDigits = count % 100;
    const lastDigit = count % 10;

    if (lastTwoDigits >= 11 && lastTwoDigits <= 14) {
      return `${count} задач`;
    }
    if (lastDigit === 1) {
      return `${count} задача`;
    }
    if (lastDigit >= 2 && lastDigit <= 4) {
      return `${count} задачи`;
    }
    return `${count} задач`;
  }

  function getCompletedDay(task) {
    if (!task.completedAt) {
      return null;
    }
    const completedDate = new Date(task.completedAt);
    return Number.isNaN(completedDate.getTime())
      ? null
      : startOfDay(completedDate);
  }

  function getOverdueEventDay(task, now = new Date()) {
    const dueDate = parseDateValue(task.date);
    if (!dueDate) {
      return null;
    }

    const completedDay = getCompletedDay(task);
    if (completedDay) {
      return completedDay > dueDate ? addDays(dueDate, 1) : null;
    }
    return startOfDay(now) > dueDate ? addDays(dueDate, 1) : null;
  }

  function calculateWeeklyReport(weekStart, now = new Date()) {
    const normalizedWeekStart = getMonday(weekStart);
    const weekEnd = addDays(normalizedWeekStart, 6);
    const startValue = formatDateValue(normalizedWeekStart);
    const endValue = formatDateValue(weekEnd);
    const plannedTasks = database.tasks.filter(
      (task) => task.date >= startValue && task.date <= endValue
    );
    const completedEvents = database.tasks
      .map((task) => ({ task, day: getCompletedDay(task) }))
      .filter(
        (event) =>
          event.day &&
          event.day >= normalizedWeekStart &&
          event.day <= weekEnd
      );
    const overdueEvents = database.tasks
      .map((task) => ({ task, day: getOverdueEventDay(task, now) }))
      .filter(
        (event) =>
          event.day &&
          event.day >= normalizedWeekStart &&
          event.day <= weekEnd
      );
    const completedOnTime = plannedTasks.filter((task) => {
      const completedDay = getCompletedDay(task);
      const dueDate = parseDateValue(task.date);
      return completedDay && dueDate && completedDay <= dueDate;
    }).length;
    const daily = Array.from({ length: 7 }, (_, index) => {
      const day = addDays(normalizedWeekStart, index);
      const dayValue = formatDateValue(day);
      return {
        day,
        completed: completedEvents.filter(
          (event) => formatDateValue(event.day) === dayValue
        ).length,
        overdue: overdueEvents.filter(
          (event) => formatDateValue(event.day) === dayValue
        ).length
      };
    });

    return {
      weekStart: normalizedWeekStart,
      weekEnd,
      planned: plannedTasks.length,
      completed: completedEvents.length,
      overdue: overdueEvents.length,
      completionRate:
        plannedTasks.length === 0
          ? 0
          : Math.round((completedOnTime / plannedTasks.length) * 100),
      daily
    };
  }

  function createSvgElement(name, attributes = {}, text = "") {
    const element = document.createElementNS(SVG_NAMESPACE, name);
    Object.entries(attributes).forEach(([attribute, value]) => {
      element.setAttribute(attribute, String(value));
    });
    if (text !== "") {
      element.textContent = text;
    }
    return element;
  }

  function renderReportChart(dailyData) {
    const description = createSvgElement(
      "desc",
      { id: "report-chart-description" },
      "Столбчатая диаграмма выполненных и ставших просроченными задач по дням недели."
    );
    const chartLeft = 55;
    const chartTop = 20;
    const chartHeight = 230;
    const chartWidth = 680;
    const groupWidth = chartWidth / 7;
    const barWidth = 24;
    const maximumValue = Math.max(
      1,
      ...dailyData.flatMap((item) => [item.completed, item.overdue])
    );
    const tickValues = [
      ...new Set(
        Array.from({ length: 5 }, (_, index) =>
          Math.round((maximumValue * index) / 4)
        )
      )
    ].sort((firstValue, secondValue) => firstValue - secondValue);
    const chartElements = [description];

    tickValues.forEach((tickValue) => {
      const y =
        chartTop + chartHeight - (tickValue / maximumValue) * chartHeight;
      chartElements.push(
        createSvgElement("line", {
          x1: chartLeft,
          y1: y,
          x2: chartLeft + chartWidth,
          y2: y,
          class: "chart-grid-line"
        }),
        createSvgElement(
          "text",
          {
            x: chartLeft - 10,
            y: y + 4,
            "text-anchor": "end",
            class: "chart-axis-text"
          },
          String(tickValue)
        )
      );
    });

    dailyData.forEach((item, index) => {
      const centerX = chartLeft + groupWidth * index + groupWidth / 2;
      const completedHeight =
        (item.completed / maximumValue) * chartHeight;
      const overdueHeight = (item.overdue / maximumValue) * chartHeight;
      const completedX = centerX - barWidth - 3;
      const overdueX = centerX + 3;

      chartElements.push(
        createSvgElement("rect", {
          x: completedX,
          y: chartTop + chartHeight - completedHeight,
          width: barWidth,
          height: completedHeight,
          rx: 3,
          class: "chart-bar-completed"
        }),
        createSvgElement("rect", {
          x: overdueX,
          y: chartTop + chartHeight - overdueHeight,
          width: barWidth,
          height: overdueHeight,
          rx: 3,
          class: "chart-bar-overdue"
        }),
        createSvgElement(
          "text",
          {
            x: centerX,
            y: chartTop + chartHeight + 24,
            "text-anchor": "middle",
            class: "chart-day-text"
          },
          `${chartDayFormatter
            .format(item.day)
            .replace(".", "")} ${item.day.getDate()}`
        )
      );

      if (item.completed > 0) {
        chartElements.push(
          createSvgElement(
            "text",
            {
              x: completedX + barWidth / 2,
              y: chartTop + chartHeight - completedHeight - 6,
              class: "chart-value-text"
            },
            String(item.completed)
          )
        );
      }
      if (item.overdue > 0) {
        chartElements.push(
          createSvgElement(
            "text",
            {
              x: overdueX + barWidth / 2,
              y: chartTop + chartHeight - overdueHeight - 6,
              class: "chart-value-text"
            },
            String(item.overdue)
          )
        );
      }
    });

    reportChart.replaceChildren(...chartElements);
  }

  function renderReports() {
    if (!database) {
      return;
    }
    const report = calculateWeeklyReport(reportWeekStart);
    reportWeekLabel.textContent = `${reportRangeFormatter.format(
      report.weekStart
    )} — ${reportRangeFormatter.format(report.weekEnd)}`;
    metricPlanned.textContent = String(report.planned);
    metricCompleted.textContent = String(report.completed);
    metricOverdue.textContent = String(report.overdue);
    metricCompletionRate.textContent = `${report.completionRate}%`;
    renderReportChart(report.daily);
  }

  function cleanupExpiredCompletedTasks(sourceDatabase, now = new Date()) {
    const expirationAge = 30 * 24 * 60 * 60 * 1000;
    const expiredTasks = sourceDatabase.tasks.filter((task) => {
      if (!task.completedAt) {
        return false;
      }
      const completedAt = new Date(task.completedAt);
      return (
        !Number.isNaN(completedAt.getTime()) &&
        now.getTime() - completedAt.getTime() >= expirationAge
      );
    });
    if (expiredTasks.length === 0) {
      return { changed: false, database: sourceDatabase };
    }

    const expiredIds = new Set(expiredTasks.map((task) => task.id));
    let recurrenceRules = sourceDatabase.recurrenceRules;
    expiredTasks.forEach((task) => {
      if (task.recurrenceRuleId && task.recurrenceDate) {
        recurrenceRules = addRuleException(
          recurrenceRules,
          task.recurrenceRuleId,
          task.recurrenceDate
        );
      }
    });
    return {
      changed: true,
      database: {
        ...sourceDatabase,
        tasks: sourceDatabase.tasks.filter((task) => !expiredIds.has(task.id)),
        recurrenceRules
      }
    };
  }

  function getRecurrenceRule(ruleId, sourceDatabase = database) {
    return sourceDatabase?.recurrenceRules.find((rule) => rule.id === ruleId) || null;
  }

  function createRecurringTask(rule, dateValue) {
    return {
      id: createTaskId(),
      ...rule.template,
      date: dateValue,
      recurrenceRuleId: rule.id,
      recurrenceDate: dateValue,
      sortOrder: null,
      isCompleted: false,
      completedAt: null,
      createdAt: new Date().toISOString()
    };
  }

  function replenishRecurringTasks(sourceDatabase, referenceDate = new Date(), onlyRuleId = null) {
    const referenceDay = startOfDay(referenceDate);
    let tasks = [...sourceDatabase.tasks];
    let changed = false;

    const recurrenceRules = sourceDatabase.recurrenceRules.map((rule) => {
      if (!rule.isActive || (onlyRuleId && rule.id !== onlyRuleId)) {
        return rule;
      }

      const ruleStartDate = parseDateValue(rule.startDate);
      if (!ruleStartDate || !["daily", "weekly"].includes(rule.type)) {
        return rule;
      }

      const horizonBase = ruleStartDate > referenceDay ? ruleStartDate : referenceDay;
      const horizonEnd = addDays(horizonBase, 30);
      const exceptions = new Set(Array.isArray(rule.exceptions) ? rule.exceptions : []);
      const existingDates = new Set(
        tasks
          .filter((task) => task.recurrenceRuleId === rule.id && task.recurrenceDate)
          .map((task) => task.recurrenceDate)
      );

      for (let cursor = new Date(horizonBase); cursor <= horizonEnd; cursor = addDays(cursor, 1)) {
        const dateValue = formatDateValue(cursor);
        const matchesRule =
          rule.type === "daily" ||
          (rule.type === "weekly" && cursor.getDay() === Number(rule.weekday));

        if (
          cursor >= ruleStartDate &&
          matchesRule &&
          !exceptions.has(dateValue) &&
          !existingDates.has(dateValue)
        ) {
          tasks.push(createRecurringTask(rule, dateValue));
          existingDates.add(dateValue);
          changed = true;
        }
      }

      const generatedThrough = formatDateValue(horizonEnd);
      if (rule.generatedThrough !== generatedThrough) {
        changed = true;
        return { ...rule, generatedThrough, updatedAt: new Date().toISOString() };
      }
      return rule;
    });

    return {
      changed,
      database: { ...sourceDatabase, tasks, recurrenceRules }
    };
  }

  function addRuleException(rules, ruleId, dateValue) {
    return rules.map((rule) => {
      if (rule.id !== ruleId) {
        return rule;
      }
      const exceptions = new Set(Array.isArray(rule.exceptions) ? rule.exceptions : []);
      exceptions.add(dateValue);
      return {
        ...rule,
        exceptions: [...exceptions].sort(),
        updatedAt: new Date().toISOString()
      };
    });
  }

  function createDayCard(date, isSelected) {
    const button = document.createElement("button");
    const weekday = document.createElement("span");
    const number = document.createElement("span");
    const taskCount = document.createElement("span");

    button.type = "button";
    button.className = `day-card${isSelected ? " is-selected" : ""}`;
    button.dataset.date = formatDateValue(date);
    const taskCountValue = getTaskCount(button.dataset.date);
    button.setAttribute("aria-label", `${fullDateFormatter.format(date)}, ${formatTaskCount(taskCountValue)}`);
    button.setAttribute("aria-pressed", String(isSelected));

    weekday.className = "day-card__weekday";
    weekday.textContent = weekdayFormatter.format(date).replace(".", "");
    number.className = "day-card__number";
    number.textContent = String(date.getDate());
    taskCount.className = "day-card__tasks";
    taskCount.textContent = formatTaskCount(taskCountValue);

    button.append(weekday, number, taskCount);
    return button;
  }

  function renderDateControls() {
    dateInput.value = formatDateValue(selectedDate);
    taskDateInput.value = formatDateValue(selectedDate);

    const days = [];
    for (let offset = -3; offset <= 3; offset += 1) {
      days.push(createDayCard(addDays(selectedDate, offset), offset === 0));
    }
    weekStrip.replaceChildren(...days);

    const selectedDay = weekStrip.querySelector(".is-selected");
    selectedDay?.scrollIntoView({ block: "nearest", inline: "center" });
  }

  function selectDate(date) {
    if (editingTaskId) {
      resetTaskForm();
      closeTaskDrawer(false);
    }
    selectedDate = startOfDay(date);
    renderDateControls();
    renderTaskList();
  }

  function compareManualOrder(firstTask, secondTask) {
    const firstHasManualOrder = Number.isFinite(firstTask.sortOrder);
    const secondHasManualOrder = Number.isFinite(secondTask.sortOrder);

    if (firstHasManualOrder && secondHasManualOrder) {
      return firstTask.sortOrder - secondTask.sortOrder;
    }
    if (firstHasManualOrder !== secondHasManualOrder) {
      return firstHasManualOrder ? -1 : 1;
    }
    return null;
  }

  function compareTasks(firstTask, secondTask) {
    const manualOrder = compareManualOrder(firstTask, secondTask);
    if (manualOrder !== null) {
      return manualOrder;
    }

    const firstHasTime = Boolean(firstTask.time);
    const secondHasTime = Boolean(secondTask.time);

    if (firstHasTime !== secondHasTime) {
      return firstHasTime ? -1 : 1;
    }

    if (firstHasTime && firstTask.time !== secondTask.time) {
      return firstTask.time.localeCompare(secondTask.time);
    }

    const priorityDifference =
      (priorityDetails[firstTask.priority]?.rank ?? 1) -
      (priorityDetails[secondTask.priority]?.rank ?? 1);

    if (priorityDifference !== 0) {
      return priorityDifference;
    }

    return String(firstTask.createdAt).localeCompare(String(secondTask.createdAt));
  }

  function compareCompletedTasks(firstTask, secondTask) {
    const manualOrder = compareManualOrder(firstTask, secondTask);
    if (manualOrder !== null) {
      return manualOrder;
    }
    return String(secondTask.completedAt).localeCompare(
      String(firstTask.completedAt)
    );
  }

  function isTaskOverdue(task) {
    return !task.isCompleted && task.date < formatDateValue(startOfDay(new Date()));
  }

  function canUseManualSorting() {
    return true;
  }

  function createTaskCard(task, allowManualSorting = true) {
    const priority = priorityDetails[task.priority] || priorityDetails.medium;
    const recurrenceRule = task.recurrenceRuleId
      ? getRecurrenceRule(task.recurrenceRuleId)
      : null;
    const isCompleted = Boolean(task.isCompleted);
    const isOverdue = isTaskOverdue(task);
    const card = document.createElement("article");
    const top = document.createElement("div");
    const title = document.createElement("h3");
    const priorityBadge = document.createElement("span");
    const priorityIcon = document.createElement("span");
    const priorityText = document.createElement("span");
    const meta = document.createElement("div");
    const time = document.createElement("span");
    const actions = document.createElement("div");
    const menu = document.createElement("details");
    const menuSummary = document.createElement("summary");
    const menuItems = document.createElement("div");
    const editButton = document.createElement("button");
    const deleteButton = document.createElement("button");

    card.className = [
      "task-card",
      `task-card--${task.priority in priorityDetails ? task.priority : "medium"}`,
      isCompleted ? "is-completed" : "",
      isOverdue ? "is-overdue" : ""
    ].filter(Boolean).join(" ");
    card.dataset.taskId = task.id;
    const manualSortingEnabled =
      allowManualSorting && canUseManualSorting();
    card.draggable = manualSortingEnabled;
    top.className = "task-card__top";
    title.className = "task-card__title";
    title.textContent = task.title;

    priorityBadge.className = "priority-badge";
    priorityIcon.className = "priority-badge__icon";
    priorityIcon.setAttribute("aria-hidden", "true");
    priorityIcon.textContent = priority.icon;
    priorityText.textContent = priority.label;
    priorityBadge.append(priorityIcon, priorityText);
    top.append(title, priorityBadge);

    meta.className = "task-card__meta";
    time.className = "task-card__time";
    time.textContent = task.time
      ? `${task.time}${task.durationMinutes ? ` · ${task.durationMinutes} мин` : ""}`
      : "Без времени";
    meta.append(time);

    if (filters.status === "overdue") {
      const taskDate = document.createElement("span");
      const parsedTaskDate = parseDateValue(task.date);
      taskDate.textContent = parsedTaskDate
        ? fullDateFormatter.format(parsedTaskDate)
        : task.date;
      meta.append(taskDate);
    }

    if (task.clientTag) {
      const clientTag = document.createElement("span");
      clientTag.className = "client-tag";
      clientTag.textContent = task.clientTag;
      meta.append(clientTag);
    }

    if (recurrenceRule) {
      const seriesBadge = document.createElement("span");
      const seriesIcon = document.createElement("span");
      const seriesText = document.createElement("span");
      seriesBadge.className = "series-badge";
      seriesIcon.setAttribute("aria-hidden", "true");
      seriesIcon.textContent = "↻";
      seriesText.textContent = recurrenceRule.type === "daily" ? "Ежедневно" : "Еженедельно";
      seriesBadge.append(seriesIcon, seriesText);
      meta.append(seriesBadge);
    }

    if (isOverdue) {
      const overdueBadge = document.createElement("span");
      const overdueIcon = document.createElement("span");
      const overdueText = document.createElement("span");
      overdueBadge.className = "overdue-badge";
      overdueIcon.setAttribute("aria-hidden", "true");
      overdueIcon.textContent = "⚠";
      overdueText.textContent = "Просрочено";
      overdueBadge.append(overdueIcon, overdueText);
      meta.append(overdueBadge);
    }

    if (isCompleted && task.completedAt) {
      const completedAt = document.createElement("span");
      const completionDate = new Date(task.completedAt);
      completedAt.textContent = Number.isNaN(completionDate.getTime())
        ? "Завершена"
        : `Завершена ${completionFormatter.format(completionDate)}`;
      meta.append(completedAt);
    }

    actions.className = "task-card__actions";
    if (manualSortingEnabled) {
      const dragHandle = document.createElement("span");
      dragHandle.className = "drag-handle";
      dragHandle.setAttribute("aria-hidden", "true");
      dragHandle.title = "Перетащите для изменения порядка";
      dragHandle.textContent = "⠿";
      actions.append(dragHandle);
    }

    if (!isCompleted) {
      const completeButton = document.createElement("button");
      completeButton.type = "button";
      completeButton.className = "complete-button";
      completeButton.dataset.taskAction = "complete";
      completeButton.dataset.taskId = task.id;
      completeButton.textContent = "✓ Выполнить";
      actions.append(completeButton);
    }

    menu.className = "task-menu";
    menuSummary.setAttribute("aria-label", `Меню задачи: ${task.title}`);
    menuSummary.textContent = "⋯";
    menuItems.className = "task-menu__items";

    editButton.type = "button";
    editButton.dataset.taskAction = "edit";
    editButton.dataset.taskId = task.id;
    editButton.textContent = "Редактировать";
    editButton.disabled = isCompleted;
    if (isCompleted) {
      editButton.title = "Завершённую задачу нельзя редактировать";
    }

    deleteButton.type = "button";
    deleteButton.dataset.taskAction = "delete";
    deleteButton.dataset.taskId = task.id;
    deleteButton.textContent = "Удалить";

    menuItems.append(editButton, deleteButton);
    if (recurrenceRule?.isActive) {
      const stopSeriesButton = document.createElement("button");
      stopSeriesButton.type = "button";
      stopSeriesButton.dataset.taskAction = "stop-series";
      stopSeriesButton.dataset.ruleId = recurrenceRule.id;
      stopSeriesButton.textContent = "Остановить серию";
      menuItems.append(stopSeriesButton);
    }
    menu.append(menuSummary, menuItems);
    actions.append(menu);
    card.append(top, meta, actions);
    return card;
  }

  function createEmptyState(titleText, description) {
    const emptyState = document.createElement("div");
    const emptyTitle = document.createElement("strong");
    const emptyText = document.createElement("p");
    emptyState.className = "empty-tasks";
    emptyTitle.textContent = titleText;
    emptyText.textContent = description;
    emptyState.append(emptyTitle, emptyText);
    return emptyState;
  }

  function renderClientFilterOptions() {
    const availableClients = [
      ...new Set(
        database.tasks
          .map((task) => String(task.clientTag || "").trim())
          .filter(Boolean)
      )
    ].sort((firstClient, secondClient) =>
      firstClient.localeCompare(secondClient, "ru")
    );
    const allClientsOption = document.createElement("option");
    allClientsOption.value = "all";
    allClientsOption.textContent = "Все клиенты";
    const clientOptions = availableClients.map((client) => {
      const option = document.createElement("option");
      option.value = client;
      option.textContent = client;
      return option;
    });

    if (filters.client !== "all" && !availableClients.includes(filters.client)) {
      filters.client = "all";
    }
    clientFilter.replaceChildren(allClientsOption, ...clientOptions);
    clientFilter.value = filters.client;
  }

  function matchesSecondaryFilters(task) {
    const matchesPriority =
      filters.priority === "all" || task.priority === filters.priority;
    const matchesClient =
      filters.client === "all" || task.clientTag === filters.client;
    return matchesPriority && matchesClient;
  }

  function renderTaskList() {
    if (!database || !Array.isArray(database.tasks)) {
      return;
    }

    renderClientFilterOptions();
    const selectedDateValue = formatDateValue(selectedDate);
    const tasksForDay = database.tasks.filter((task) => task.date === selectedDateValue);
    const completedTasksForDetails = tasksForDay
      .filter((task) => task.isCompleted)
      .filter(matchesSecondaryFilters)
      .slice()
      .sort(compareCompletedTasks);

    let visibleTasks;
    let emptyTitle;
    let emptyDescription;

    if (filters.status === "completed") {
      visibleTasks = completedTasksForDetails;
      taskListContext.textContent = "План на день";
      taskListTitle.textContent = "Выполненные задачи";
      emptyTitle = "Выполненных задач нет";
      emptyDescription = "Завершённые задачи выбранного дня появятся здесь.";
    } else if (filters.status === "overdue") {
      visibleTasks = database.tasks
        .filter(isTaskOverdue)
        .filter(matchesSecondaryFilters)
        .slice()
        .sort((firstTask, secondTask) =>
          firstTask.date === secondTask.date
            ? compareTasks(firstTask, secondTask)
            : firstTask.date.localeCompare(secondTask.date)
        );
      taskListContext.textContent = "Все даты";
      taskListTitle.textContent = "Просроченные задачи";
      emptyTitle = "Просроченных задач нет";
      emptyDescription = "Незавершённые задачи за прошлые даты появятся здесь.";
    } else {
      visibleTasks = tasksForDay
        .filter((task) => !task.isCompleted)
        .filter(matchesSecondaryFilters)
        .slice()
        .sort(compareTasks);
      taskListContext.textContent = "План на день";
      taskListTitle.textContent = "Активные задачи";
      emptyTitle = "Активных задач нет";
      emptyDescription = "Добавьте новую задачу или измените параметры фильтра.";
    }

    taskTotal.textContent = String(visibleTasks.length);
    completedTotal.textContent = String(completedTasksForDetails.length);
    completedSection.hidden = filters.status !== "active";

    if (visibleTasks.length === 0) {
      taskList.replaceChildren(
        createEmptyState(emptyTitle, emptyDescription)
      );
    } else {
      taskList.replaceChildren(
        ...visibleTasks.map((task) => createTaskCard(task, true))
      );
    }

    if (completedTasksForDetails.length === 0) {
      completedTaskList.replaceChildren(
        createEmptyState("Завершённых задач нет", "Выполненные задачи появятся в этом блоке.")
      );
    } else {
      completedTaskList.replaceChildren(
        ...completedTasksForDetails.map((task) => createTaskCard(task, false))
      );
    }
  }

  function syncDurationPresets() {
    durationPresetButtons.forEach((button) => {
      button.disabled = taskDurationInput.disabled;
      button.classList.toggle(
        "is-selected",
        !button.disabled && button.dataset.durationPreset === taskDurationInput.value
      );
    });
  }

  function syncDurationField() {
    const hasTime = Boolean(taskTimeInput.value);
    taskDurationInput.disabled = !hasTime;
    durationField.classList.toggle("is-disabled", !hasTime);
    if (!hasTime) {
      taskDurationInput.value = "";
    }
    syncDurationPresets();
  }

  function syncRecurrenceField() {
    const isWeekly = taskRecurrenceInput.value === "weekly";
    taskRecurrenceWeekdayInput.disabled = !isWeekly || taskRecurrenceInput.disabled;
    weekdayField.classList.toggle("is-disabled", !isWeekly || taskRecurrenceInput.disabled);
  }

  function openTaskDrawer() {
    taskFormPanel.inert = false;
    taskFormPanel.setAttribute("aria-hidden", "false");
    document.body.classList.add("is-task-drawer-open");
    taskTitleInput.focus();
  }

  function closeTaskDrawer(restoreFocus = true) {
    document.body.classList.remove("is-task-drawer-open");
    taskFormPanel.inert = true;
    taskFormPanel.setAttribute("aria-hidden", "true");
    if (restoreFocus) {
      openTaskDrawerButton.focus();
    }
  }

  function resetTaskForm() {
    editingTaskId = null;
    editingMode = "single";
    editingRuleId = null;
    editingOccurrenceDate = null;
    taskForm.reset();
    taskPriorityInput.value = "medium";
    taskDateInput.value = formatDateValue(selectedDate);
    taskRecurrenceInput.disabled = false;
    taskRecurrenceInput.value = "none";
    taskRecurrenceWeekdayInput.value = String(selectedDate.getDay());
    taskFormModeLabel.textContent = "Новый фокус";
    taskFormTitle.textContent = "Добавить в план";
    taskSubmitButton.textContent = "Добавить в план";
    cancelEditButton.hidden = true;
    taskTitleInput.setCustomValidity("");
    syncDurationField();
    syncRecurrenceField();
  }

  function startEditingTask(taskId, mode = "single") {
    const task = database.tasks.find((item) => item.id === taskId);
    if (!task || task.isCompleted) {
      return;
    }

    const recurrenceRule = task.recurrenceRuleId
      ? getRecurrenceRule(task.recurrenceRuleId)
      : null;
    editingTaskId = task.id;
    editingMode = mode;
    editingRuleId = mode === "series" ? recurrenceRule?.id || null : null;
    editingOccurrenceDate = task.recurrenceDate || task.date;
    taskTitleInput.value = task.title;
    taskDateInput.value = task.date;
    taskTimeInput.value = task.time || "";
    taskDurationInput.value = task.durationMinutes || "";
    taskPriorityInput.value = task.priority in priorityDetails ? task.priority : "medium";
    taskClientTagInput.value = task.clientTag || "";
    taskRecurrenceInput.disabled = mode !== "series";
    taskRecurrenceInput.value =
      mode === "series" && recurrenceRule ? recurrenceRule.type : "none";
    taskRecurrenceWeekdayInput.value = String(
      mode === "series" && recurrenceRule?.type === "weekly"
        ? recurrenceRule.weekday
        : parseDateValue(task.date)?.getDay() ?? selectedDate.getDay()
    );
    taskFormModeLabel.textContent = "Изменение записи";
    taskFormTitle.textContent =
      mode === "series" ? "Редактировать серию" : "Редактировать задачу";
    taskSubmitButton.textContent = "Сохранить изменения";
    cancelEditButton.hidden = false;
    syncDurationField();
    syncRecurrenceField();
    openTaskDrawer();
  }

  function canChangeDatabase() {
    if (!storageHasParseError) {
      return true;
    }
    showNotification("Сначала подтвердите сброс повреждённой базы, чтобы изменять задачи.");
    requestDatabaseReset();
    return false;
  }

  function commitDatabase(nextDatabase) {
    if (!canChangeDatabase()) {
      return false;
    }

    if (!writeDatabase(nextDatabase)) {
      return false;
    }

    database = nextDatabase;
    renderDateControls();
    renderTaskList();
    renderReports();
    return true;
  }

  function commitTasks(tasks) {
    return commitDatabase({ ...database, tasks });
  }

  function saveManualOrder(orderedVisibleIds) {
    if (!canUseManualSorting() || orderedVisibleIds.length < 2) {
      return false;
    }

    const selectedDateValue = formatDateValue(selectedDate);
    const taskById = new Map(database.tasks.map((task) => [task.id, task]));
    const eligibleTasks = database.tasks.filter((task) => {
      if (filters.status === "completed") {
        return task.date === selectedDateValue && task.isCompleted;
      }
      if (filters.status === "overdue") {
        return isTaskOverdue(task);
      }
      return task.date === selectedDateValue && !task.isCompleted;
    });
    const orderById = new Map();
    let hasSortableGroup = false;

    [...new Set(eligibleTasks.map((task) => task.date))].forEach((dateValue) => {
      const visibleIdsForDate = orderedVisibleIds.filter(
        (taskId) => taskById.get(taskId)?.date === dateValue
      );
      if (visibleIdsForDate.length < 2) {
        return;
      }

      hasSortableGroup = true;
      const visibleIds = new Set(visibleIdsForDate);
      const allTasksForDate = eligibleTasks
        .filter((task) => task.date === dateValue)
        .slice()
        .sort(
          filters.status === "completed"
            ? compareCompletedTasks
            : compareTasks
        );
      let visibleIndex = 0;
      const completeOrder = allTasksForDate.map((task) =>
        visibleIds.has(task.id)
          ? visibleIdsForDate[visibleIndex++]
          : task.id
      );
      completeOrder.forEach((taskId, index) => orderById.set(taskId, index));
    });

    if (!hasSortableGroup) {
      return false;
    }

    const nextTasks = database.tasks.map((task) =>
      orderById.has(task.id)
        ? { ...task, sortOrder: orderById.get(task.id) }
        : task
    );

    return commitTasks(nextTasks);
  }

  function deleteTask(taskId) {
    const deletedTask = database.tasks.find((task) => task.id === taskId);
    if (!deletedTask) {
      return;
    }

    const nextTasks = database.tasks.filter((task) => task.id !== taskId);
    const nextRules =
      deletedTask.recurrenceRuleId && deletedTask.recurrenceDate
        ? addRuleException(
            database.recurrenceRules,
            deletedTask.recurrenceRuleId,
            deletedTask.recurrenceDate
          )
        : database.recurrenceRules;

    if (
      commitDatabase({ ...database, tasks: nextTasks, recurrenceRules: nextRules }) &&
      editingTaskId === taskId
    ) {
      resetTaskForm();
      closeTaskDrawer();
    }
  }

  function completeTask(taskId) {
    const task = database.tasks.find((item) => item.id === taskId);
    if (!task || task.isCompleted) {
      return;
    }

    const completedAt = new Date().toISOString();
    const nextTasks = database.tasks.map((item) =>
      item.id === taskId ? { ...item, isCompleted: true, completedAt } : item
    );

    if (commitTasks(nextTasks) && editingTaskId === taskId) {
      resetTaskForm();
      closeTaskDrawer();
    }
  }

  function stopSeries(ruleId, deleteFutureTasks) {
    const rule = getRecurrenceRule(ruleId);
    if (!rule?.isActive) {
      return;
    }

    const todayValue = formatDateValue(startOfDay(new Date()));
    const stoppedAt = new Date().toISOString();
    const nextRules = database.recurrenceRules.map((item) =>
      item.id === ruleId
        ? { ...item, isActive: false, stoppedAt, updatedAt: stoppedAt }
        : item
    );
    const nextTasks = database.tasks.flatMap((task) => {
      if (task.recurrenceRuleId !== ruleId) {
        return [task];
      }

      const isFutureUnfinished =
        !task.isCompleted && task.date > todayValue;
      if (deleteFutureTasks && isFutureUnfinished) {
        return [];
      }

      return [{ ...task, recurrenceRuleId: null, recurrenceDate: null }];
    });

    if (commitDatabase({ ...database, tasks: nextTasks, recurrenceRules: nextRules })) {
      if (
        editingRuleId === ruleId ||
        (editingTaskId &&
          !nextTasks.some((task) => task.id === editingTaskId))
      ) {
        resetTaskForm();
        closeTaskDrawer();
      }
    }
  }

  function showChoiceDialog(dialog) {
    if (typeof dialog.showModal === "function") {
      dialog.showModal();
    } else {
      dialog.setAttribute("open", "");
    }
  }

  function timeToMinutes(timeValue) {
    const match = /^(\d{2}):(\d{2})$/.exec(timeValue || "");
    if (!match) {
      return null;
    }
    const hours = Number(match[1]);
    const minutes = Number(match[2]);
    if (hours > 23 || minutes > 59) {
      return null;
    }
    return hours * 60 + minutes;
  }

  function minutesToTime(totalMinutes) {
    const normalizedMinutes = ((totalMinutes % 1440) + 1440) % 1440;
    const hours = String(Math.floor(normalizedMinutes / 60)).padStart(2, "0");
    const minutes = String(normalizedMinutes % 60).padStart(2, "0");
    return `${hours}:${minutes}${totalMinutes >= 1440 ? " (+1)" : ""}`;
  }

  function getEffectiveDuration(task) {
    return Number.isInteger(task.durationMinutes) && task.durationMinutes > 0
      ? task.durationMinutes
      : 30;
  }

  function getOccupiedTasks(targetDate, excludedTaskId) {
    return database.tasks
      .filter(
        (task) =>
          task.id !== excludedTaskId &&
          task.date === targetDate &&
          !task.isCompleted &&
          timeToMinutes(task.time) !== null
      )
      .slice()
      .sort((firstTask, secondTask) =>
        firstTask.time.localeCompare(secondTask.time)
      );
  }

  function findTimeConflicts(taskId, targetDate, newTime) {
    const movingTask = database.tasks.find((task) => task.id === taskId);
    const newStart = timeToMinutes(newTime);
    if (!movingTask || newStart === null) {
      return [];
    }

    const newEnd = newStart + getEffectiveDuration(movingTask);
    return getOccupiedTasks(targetDate, taskId).filter((task) => {
      const existingStart = timeToMinutes(task.time);
      const existingEnd = existingStart + getEffectiveDuration(task);
      return newStart < existingEnd && existingStart < newEnd;
    });
  }

  function renderOccupiedIntervals(taskId, targetDate) {
    const targetTasks = getOccupiedTasks(targetDate, taskId);
    if (targetTasks.length === 0) {
      const emptyMessage = document.createElement("p");
      emptyMessage.className = "occupied-schedule__empty";
      emptyMessage.textContent = "В этот день свободно.";
      occupiedIntervals.replaceChildren(emptyMessage);
      return;
    }

    const intervals = targetTasks.map((task) => {
      const start = timeToMinutes(task.time);
      const end = start + getEffectiveDuration(task);
      const interval = document.createElement("div");
      const label = document.createElement("div");
      const time = document.createElement("span");
      const title = document.createElement("span");
      const track = document.createElement("div");
      const bar = document.createElement("span");

      interval.className = "occupied-interval";
      label.className = "occupied-interval__label";
      time.textContent = `${minutesToTime(start)}–${minutesToTime(end)}`;
      title.textContent = task.title;
      label.append(time, title);

      track.className = "occupied-interval__track";
      bar.className = "occupied-interval__bar";
      bar.style.setProperty(
        "--interval-start",
        `${(start / 1440) * 100}%`
      );
      bar.style.setProperty(
        "--interval-width",
        `${((Math.min(end, 1440) - start) / 1440) * 100}%`
      );
      track.append(bar);
      interval.append(label, track);
      return interval;
    });
    occupiedIntervals.replaceChildren(...intervals);
  }

  function updateMoveConflictWarning() {
    if (!pendingMoveTaskId || !pendingMoveTargetDate) {
      moveConflictWarning.hidden = true;
      return [];
    }

    const conflicts = findTimeConflicts(
      pendingMoveTaskId,
      pendingMoveTargetDate,
      moveTaskTimeInput.value
    );
    moveConflictWarning.hidden = conflicts.length === 0;
    moveConflictWarning.textContent =
      conflicts.length === 0
        ? ""
        : `Время пересекается с задачами: ${conflicts
            .map((task) => task.title)
            .join(", ")}. Перенос всё равно можно сохранить.`;
    return conflicts;
  }

  function moveTaskToDate(taskId, targetDate, newTime = null) {
    const task = database.tasks.find((item) => item.id === taskId);
    if (!task || !parseDateValue(targetDate)) {
      return false;
    }

    const nextTime = task.time ? newTime || task.time : null;
    if (task.date === targetDate && nextTime === task.time) {
      return false;
    }

    const nextRules =
      task.recurrenceRuleId && task.recurrenceDate
        ? addRuleException(
            database.recurrenceRules,
            task.recurrenceRuleId,
            task.recurrenceDate
          )
        : database.recurrenceRules;
    const nextTasks = database.tasks.map((item) =>
      item.id === taskId
        ? {
            ...item,
            date: targetDate,
            time: nextTime,
            recurrenceRuleId: null,
            recurrenceDate: null,
            sortOrder: null
          }
        : item
    );

    return commitDatabase({
      ...database,
      tasks: nextTasks,
      recurrenceRules: nextRules
    });
  }

  function requestTaskMove(taskId, targetDate) {
    const task = database.tasks.find((item) => item.id === taskId);
    const targetDateObject = parseDateValue(targetDate);
    if (!task || !targetDateObject || task.date === targetDate) {
      return;
    }

    if (!task.time) {
      moveTaskToDate(taskId, targetDate);
      return;
    }

    pendingMoveTaskId = taskId;
    pendingMoveTargetDate = targetDate;
    moveTargetDate.textContent = fullDateFormatter.format(targetDateObject);
    moveTaskTimeInput.value = task.time;
    const duration = getEffectiveDuration(task);
    moveTaskDuration.textContent = task.durationMinutes
      ? `Длительность: ${duration} мин.`
      : "Длительность: 30 мин. по умолчанию.";
    renderOccupiedIntervals(taskId, targetDate);
    updateMoveConflictWarning();
    showChoiceDialog(moveTaskDialog);
  }

  function clearDayDropTargets() {
    weekStrip
      .querySelectorAll(".is-drop-target")
      .forEach((day) => day.classList.toggle("is-drop-target", false));
  }

  function createTaskId() {
    if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
      return crypto.randomUUID();
    }
    return `task-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  }

  function createRecurrenceRule(taskValues, recurrenceType, weekday) {
    const now = new Date().toISOString();
    return {
      id: `rule-${createTaskId()}`,
      type: recurrenceType,
      weekday: recurrenceType === "weekly" ? Number(weekday) : null,
      startDate: taskValues.date,
      template: {
        title: taskValues.title,
        time: taskValues.time,
        durationMinutes: taskValues.durationMinutes,
        priority: taskValues.priority,
        clientTag: taskValues.clientTag
      },
      exceptions: [],
      isActive: true,
      generatedThrough: null,
      createdAt: now,
      updatedAt: now,
      stoppedAt: null
    };
  }

  function showNotification(message) {
    const notification = document.createElement("div");
    notification.className = "notification";
    notification.setAttribute("role", "alert");
    notification.textContent = message;
    notificationRegion.replaceChildren(notification);
  }

  function createExportFilename(date = new Date()) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    const hours = String(date.getHours()).padStart(2, "0");
    const minutes = String(date.getMinutes()).padStart(2, "0");
    return `tasks-planner-export-${year}${month}${day}-${hours}${minutes}.json`;
  }

  function exportDatabase() {
    try {
      const content = JSON.stringify(database, null, 2);
      const blob = new Blob([content], { type: "application/json;charset=utf-8" });
      const downloadUrl = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = downloadUrl;
      link.download = createExportFilename();
      link.hidden = true;
      document.body.append(link);
      link.click();
      link.remove();
      window.setTimeout(() => URL.revokeObjectURL(downloadUrl), 0);
    } catch (error) {
      console.error("Database export failed:", error);
      showNotification("Не удалось подготовить файл экспорта.");
    }
  }

  function isQuotaExceededError(error) {
    return (
      error instanceof DOMException &&
      (error.name === "QuotaExceededError" || error.code === 22 || error.code === 1014)
    );
  }

  function writeDatabase(database) {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(database));
      return true;
    } catch (error) {
      if (isQuotaExceededError(error)) {
        showNotification("Локальное хранилище заполнено. Экспортируйте данные, чтобы избежать их потери.");
      } else {
        showNotification("Не удалось сохранить данные в локальном хранилище.");
        console.error("Storage write failed:", error);
      }
      return false;
    }
  }

  function requestDatabaseReset() {
    if (typeof storageErrorDialog.showModal === "function") {
      storageErrorDialog.showModal();
      return;
    }

    storageErrorDialog.setAttribute("open", "");
  }

  function readDatabase() {
    let rawDatabase;

    try {
      rawDatabase = window.localStorage.getItem(STORAGE_KEY);
    } catch (error) {
      showNotification("Не удалось прочитать данные из локального хранилища.");
      console.error("Storage read failed:", error);
      return createEmptyDatabase();
    }

    if (rawDatabase === null) {
      const emptyDatabase = createEmptyDatabase();
      writeDatabase(emptyDatabase);
      return emptyDatabase;
    }

    try {
      const parsedDatabase = JSON.parse(rawDatabase);
      const hasValidShape =
        parsedDatabase &&
        typeof parsedDatabase === "object" &&
        "schemaVersion" in parsedDatabase &&
        Array.isArray(parsedDatabase.tasks) &&
        Array.isArray(parsedDatabase.recurrenceRules);

      if (!hasValidShape) {
        throw new SyntaxError("Database structure is invalid");
      }
      return parsedDatabase;
    } catch (error) {
      console.error("Database JSON is invalid:", error);
      storageHasParseError = true;
      requestDatabaseReset();
      return createEmptyDatabase();
    }
  }

  function resetDatabase() {
    const emptyDatabase = createEmptyDatabase();
    if (writeDatabase(emptyDatabase)) {
      database = emptyDatabase;
      storageHasParseError = false;
      resetTaskForm();
      closeTaskDrawer(false);
      renderDateControls();
      renderTaskList();
      renderReports();
      showNotification("Повреждённая база сброшена. Создано пустое хранилище.");
    }
  }

  function switchScreen(screenName) {
    closeTaskDrawer(false);
    document.querySelectorAll("[data-screen-panel]").forEach((panel) => {
      const isActive = panel.dataset.screenPanel === screenName;
      panel.hidden = !isActive;
      panel.classList.toggle("is-active", isActive);
    });

    document.querySelectorAll("[data-screen]").forEach((button) => {
      const isActive = button.dataset.screen === screenName;
      button.classList.toggle("is-active", isActive);

      if (isActive) {
        button.setAttribute("aria-current", "page");
      } else {
        button.removeAttribute("aria-current");
      }
    });

    if (screenName === "reports") {
      renderReports();
    }
  }

  document.querySelector(".main-nav").addEventListener("click", (event) => {
    const navigationButton = event.target.closest("[data-screen]");
    if (navigationButton) {
      switchScreen(navigationButton.dataset.screen);
    }
  });

  document.querySelector(".date-planner").addEventListener("click", (event) => {
    const dateActionButton = event.target.closest("[data-date-action]");
    if (dateActionButton) {
      const action = dateActionButton.dataset.dateAction;
      if (action === "previous") {
        selectDate(addDays(selectedDate, -1));
      } else if (action === "next") {
        selectDate(addDays(selectedDate, 1));
      }
      return;
    }

    const dayButton = event.target.closest("[data-date]");
    const date = dayButton ? parseDateValue(dayButton.dataset.date) : null;
    if (date) {
      selectDate(date);
    }
  });

  dateInput.addEventListener("change", () => {
    const date = parseDateValue(dateInput.value);
    if (date) {
      selectDate(date);
    } else {
      dateInput.value = formatDateValue(selectedDate);
    }
  });

  previousReportWeekButton.addEventListener("click", () => {
    reportWeekStart = addDays(reportWeekStart, -7);
    renderReports();
  });

  nextReportWeekButton.addEventListener("click", () => {
    reportWeekStart = addDays(reportWeekStart, 7);
    renderReports();
  });

  exportDatabaseButton.addEventListener("click", exportDatabase);

  taskTimeInput.addEventListener("input", syncDurationField);
  taskDurationInput.addEventListener("input", syncDurationPresets);

  durationPresetButtons.forEach((button) => {
    button.addEventListener("click", () => {
      taskDurationInput.value = button.dataset.durationPreset;
      syncDurationPresets();
      taskDurationInput.focus();
    });
  });

  taskRecurrenceInput.addEventListener("change", () => {
    if (taskRecurrenceInput.value === "weekly") {
      const taskDate = parseDateValue(taskDateInput.value);
      taskRecurrenceWeekdayInput.value = String(
        taskDate?.getDay() ?? selectedDate.getDay()
      );
    }
    syncRecurrenceField();
  });

  taskDateInput.addEventListener("change", () => {
    const taskDate = parseDateValue(taskDateInput.value);
    if (taskDate && taskRecurrenceInput.value === "weekly") {
      taskRecurrenceWeekdayInput.value = String(taskDate.getDay());
    }
  });

  taskTitleInput.addEventListener("input", () => {
    taskTitleInput.setCustomValidity("");
  });

  statusFilter.addEventListener("change", () => {
    filters.status = statusFilter.value;
    renderTaskList();
  });

  priorityFilter.addEventListener("change", () => {
    filters.priority = priorityFilter.value;
    renderTaskList();
  });

  clientFilter.addEventListener("change", () => {
    filters.client = clientFilter.value;
    renderTaskList();
  });

  taskList.addEventListener("dragstart", (event) => {
    const card = event.target.closest(".task-card[data-task-id]");
    if (!card || !card.draggable || !canUseManualSorting()) {
      event.preventDefault();
      return;
    }

    draggedTaskId = card.dataset.taskId;
    card.classList.toggle("is-dragging", true);
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("text/plain", draggedTaskId);
  });

  taskList.addEventListener("dragover", (event) => {
    if (!draggedTaskId || !canUseManualSorting()) {
      return;
    }

    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
    const targetCard = event.target.closest(".task-card[data-task-id]");
    const draggedCard = [...taskList.querySelectorAll(".task-card[data-task-id]")]
      .find((card) => card.dataset.taskId === draggedTaskId);

    if (!targetCard || !draggedCard || targetCard === draggedCard) {
      return;
    }
    const draggedTask = database.tasks.find(
      (task) => task.id === draggedTaskId
    );
    const targetTask = database.tasks.find(
      (task) => task.id === targetCard.dataset.taskId
    );
    if (!draggedTask || !targetTask || draggedTask.date !== targetTask.date) {
      return;
    }

    const targetRect = targetCard.getBoundingClientRect();
    const insertAfter = event.clientY > targetRect.top + targetRect.height / 2;
    taskList.insertBefore(
      draggedCard,
      insertAfter ? targetCard.nextSibling : targetCard
    );
  });

  taskList.addEventListener("drop", (event) => {
    if (!draggedTaskId || !canUseManualSorting()) {
      return;
    }

    event.preventDefault();
    const cards = [...taskList.querySelectorAll(".task-card[data-task-id]")];
    cards.forEach((card) => card.classList.toggle("is-dragging", false));
    const orderedVisibleIds = cards.map((card) => card.dataset.taskId);
    draggedTaskId = null;
    saveManualOrder(orderedVisibleIds);
  });

  taskList.addEventListener("dragend", () => {
    taskList
      .querySelectorAll(".is-dragging")
      .forEach((card) => card.classList.toggle("is-dragging", false));
    clearDayDropTargets();
    draggedTaskId = null;
  });

  weekStrip.addEventListener("dragover", (event) => {
    if (!draggedTaskId || !canUseManualSorting()) {
      return;
    }

    const targetDay = event.target.closest("[data-date]");
    if (!targetDay) {
      return;
    }

    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
    clearDayDropTargets();
    targetDay.classList.toggle("is-drop-target", true);
  });

  weekStrip.addEventListener("dragleave", (event) => {
    const targetDay = event.target.closest("[data-date]");
    if (targetDay && !targetDay.contains(event.relatedTarget)) {
      targetDay.classList.toggle("is-drop-target", false);
    }
  });

  weekStrip.addEventListener("drop", (event) => {
    const targetDay = event.target.closest("[data-date]");
    if (!draggedTaskId || !targetDay || !canUseManualSorting()) {
      return;
    }

    event.preventDefault();
    const taskId = draggedTaskId;
    draggedTaskId = null;
    clearDayDropTargets();
    requestTaskMove(taskId, targetDay.dataset.date);
  });

  openTaskDrawerButton.addEventListener("click", () => {
    resetTaskForm();
    openTaskDrawer();
  });

  closeTaskDrawerButton.addEventListener("click", () => {
    resetTaskForm();
    closeTaskDrawer();
  });

  taskDrawerBackdrop.addEventListener("click", () => {
    resetTaskForm();
    closeTaskDrawer();
  });

  document.addEventListener("keydown", (event) => {
    if (
      event.key === "Escape" &&
      document.body.classList.contains("is-task-drawer-open")
    ) {
      resetTaskForm();
      closeTaskDrawer();
    }
  });

  taskForm.addEventListener("submit", (event) => {
    event.preventDefault();

    const title = taskTitleInput.value.trim();
    if (!title) {
      taskTitleInput.setCustomValidity("Введите название задачи.");
      taskTitleInput.reportValidity();
      return;
    }

    if (!canChangeDatabase()) {
      return;
    }

    const taskDate = parseDateValue(taskDateInput.value);
    if (!taskDate) {
      taskDateInput.reportValidity();
      return;
    }

    const time = taskTimeInput.value || null;
    const durationValue = time ? Number.parseInt(taskDurationInput.value, 10) : null;
    const taskValues = {
      title,
      date: formatDateValue(taskDate),
      time,
      durationMinutes: Number.isInteger(durationValue) && durationValue > 0 ? durationValue : null,
      priority: taskPriorityInput.value in priorityDetails ? taskPriorityInput.value : "medium",
      clientTag: taskClientTagInput.value.trim()
    };

    let wasCommitted = false;
    if (editingTaskId) {
      const editedTask = database.tasks.find((task) => task.id === editingTaskId);
      if (!editedTask || editedTask.isCompleted) {
        resetTaskForm();
        closeTaskDrawer();
        renderTaskList();
        return;
      }

      if (editingMode === "series" && editingRuleId) {
        const editedRule = getRecurrenceRule(editingRuleId);
        const recurrenceType = taskRecurrenceInput.value;
        if (
          !editedRule?.isActive ||
          !["daily", "weekly"].includes(recurrenceType)
        ) {
          showNotification("Для серии выберите ежедневное или еженедельное повторение.");
          return;
        }

        const now = new Date().toISOString();
        const updatedRule = {
          ...editedRule,
          type: recurrenceType,
          weekday:
            recurrenceType === "weekly"
              ? Number(taskRecurrenceWeekdayInput.value)
              : null,
          startDate: taskValues.date,
          template: {
            title: taskValues.title,
            time: taskValues.time,
            durationMinutes: taskValues.durationMinutes,
            priority: taskValues.priority,
            clientTag: taskValues.clientTag
          },
          updatedAt: now,
          generatedThrough: null
        };
        const todayValue = formatDateValue(startOfDay(new Date()));
        const cutoffDate =
          editingOccurrenceDate < todayValue ? todayValue : editingOccurrenceDate;
        const tasksBeforeRegeneration = database.tasks.filter(
          (task) =>
            !(
              task.recurrenceRuleId === editingRuleId &&
              !task.isCompleted &&
              task.recurrenceDate >= cutoffDate
            )
        );
        const rulesWithUpdate = database.recurrenceRules.map((rule) =>
          rule.id === editingRuleId ? updatedRule : rule
        );
        const baseDatabase = {
          ...database,
          tasks: tasksBeforeRegeneration,
          recurrenceRules: rulesWithUpdate
        };
        const generationBase =
          taskDate > startOfDay(new Date()) ? taskDate : startOfDay(new Date());
        const replenished = replenishRecurringTasks(
          baseDatabase,
          generationBase,
          editingRuleId
        );
        wasCommitted = commitDatabase(replenished.database);
      } else {
        const nextRules =
          editedTask.recurrenceRuleId && editedTask.recurrenceDate
            ? addRuleException(
                database.recurrenceRules,
                editedTask.recurrenceRuleId,
                editedTask.recurrenceDate
              )
            : database.recurrenceRules;
        const nextTasks = database.tasks.map((task) =>
          task.id === editingTaskId
            ? {
                ...task,
                ...taskValues,
                recurrenceRuleId: null,
                recurrenceDate: null,
                sortOrder:
                  task.date === taskValues.date ? task.sortOrder ?? null : null
              }
            : task
        );
        wasCommitted = commitDatabase({
          ...database,
          tasks: nextTasks,
          recurrenceRules: nextRules
        });
      }
    } else {
      const recurrenceType = taskRecurrenceInput.value;
      if (["daily", "weekly"].includes(recurrenceType)) {
        const newRule = createRecurrenceRule(
          taskValues,
          recurrenceType,
          taskRecurrenceWeekdayInput.value
        );
        const baseDatabase = {
          ...database,
          recurrenceRules: [...database.recurrenceRules, newRule]
        };
        const generationBase =
          taskDate > startOfDay(new Date()) ? taskDate : startOfDay(new Date());
        const replenished = replenishRecurringTasks(
          baseDatabase,
          generationBase,
          newRule.id
        );
        wasCommitted = commitDatabase(replenished.database);
      } else {
        const newTask = {
          id: createTaskId(),
          ...taskValues,
          recurrenceRuleId: null,
          recurrenceDate: null,
          sortOrder: null,
          isCompleted: false,
          completedAt: null,
          createdAt: new Date().toISOString()
        };
        wasCommitted = commitTasks([...database.tasks, newTask]);
      }
    }

    if (wasCommitted) {
      resetTaskForm();
      closeTaskDrawer();
    }
  });

  cancelEditButton.addEventListener("click", () => {
    resetTaskForm();
    closeTaskDrawer();
  });

  taskListPanel.addEventListener("click", (event) => {
    const actionButton = event.target.closest("[data-task-action]");
    if (!actionButton) {
      return;
    }

    const { taskAction, taskId, ruleId } = actionButton.dataset;
    if (taskAction === "edit") {
      const task = database.tasks.find((item) => item.id === taskId);
      const rule = task?.recurrenceRuleId
        ? getRecurrenceRule(task.recurrenceRuleId)
        : null;
      if (task && !task.isCompleted && rule?.isActive) {
        pendingEditTaskId = taskId;
        showChoiceDialog(editScopeDialog);
      } else {
        startEditingTask(taskId);
      }
    } else if (taskAction === "delete") {
      deleteTask(taskId);
    } else if (taskAction === "complete") {
      completeTask(taskId);
    } else if (taskAction === "stop-series" && ruleId) {
      pendingStopRuleId = ruleId;
      showChoiceDialog(stopSeriesDialog);
    }
  });

  editSingleInstanceButton.addEventListener("click", () => {
    if (pendingEditTaskId) {
      startEditingTask(pendingEditTaskId, "single");
      pendingEditTaskId = null;
    }
  });

  editEntireSeriesButton.addEventListener("click", () => {
    if (pendingEditTaskId) {
      startEditingTask(pendingEditTaskId, "series");
      pendingEditTaskId = null;
    }
  });

  stopSeriesKeepButton.addEventListener("click", () => {
    if (pendingStopRuleId) {
      stopSeries(pendingStopRuleId, false);
      pendingStopRuleId = null;
    }
  });

  stopSeriesDeleteButton.addEventListener("click", () => {
    if (pendingStopRuleId) {
      stopSeries(pendingStopRuleId, true);
      pendingStopRuleId = null;
    }
  });

  moveTaskTimeInput.addEventListener("input", updateMoveConflictWarning);

  confirmTaskMoveButton.addEventListener("click", (event) => {
    const newTime = moveTaskTimeInput.value;
    if (
      !pendingMoveTaskId ||
      !pendingMoveTargetDate ||
      timeToMinutes(newTime) === null
    ) {
      event.preventDefault();
      moveTaskTimeInput.reportValidity();
      return;
    }

    moveTaskToDate(
      pendingMoveTaskId,
      pendingMoveTargetDate,
      newTime
    );
    pendingMoveTaskId = null;
    pendingMoveTargetDate = null;
    moveConflictWarning.hidden = true;
  });

  moveTaskDialog.addEventListener("close", () => {
    pendingMoveTaskId = null;
    pendingMoveTargetDate = null;
    moveConflictWarning.hidden = true;
  });

  confirmResetButton.addEventListener("click", resetDatabase);

  database = readDatabase();
  if (!storageHasParseError) {
    const cleaned = cleanupExpiredCompletedTasks(database, new Date());
    const replenished = replenishRecurringTasks(cleaned.database, new Date());
    if (
      (cleaned.changed || replenished.changed) &&
      writeDatabase(replenished.database)
    ) {
      database = replenished.database;
    }
  }
  statusFilter.value = filters.status;
  priorityFilter.value = filters.priority;
  resetTaskForm();
  renderDateControls();
  renderTaskList();
  renderReports();

  window.TasksPlanner = Object.freeze({
    storageKey: STORAGE_KEY,
    getDatabase: () => database,
    readDatabase,
    writeDatabase,
    getSelectedDate: () => new Date(selectedDate),
    selectDate,
    compareTasks,
    saveManualOrder,
    findTimeConflicts,
    requestTaskMove,
    calculateWeeklyReport,
    cleanupExpiredCompletedTasks,
    createExportFilename
  });
})();
