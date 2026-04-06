DO $$
BEGIN
    BEGIN
        CREATE EXTENSION IF NOT EXISTS alloydb_ai_nl CASCADE;
    EXCEPTION
        WHEN OTHERS THEN
            RAISE NOTICE
                'AlloyDB AI natural language extension is unavailable. Enable the database flag alloydb_ai_nl.enabled on the AlloyDB instance, then rerun this script. Error: %',
                SQLERRM;
    END;
END $$;

-- Telova uses explicit parameterization metadata below to avoid setup-time
-- LLM checks where possible. Google's current AlloyDB AI natural language
-- docs still describe the managed NL endpoint as gemini-2.0-flash, which is
-- separate from Telova's application-side Gemini model configuration.

CREATE OR REPLACE VIEW public.telova_goal_execution_view AS
SELECT
    g.id AS goal_id,
    g.user_id,
    g.title AS goal_title,
    g.domain,
    g.status AS goal_status,
    g.deadline,
    g.deviation,
    COUNT(t.id) AS total_tasks,
    COALESCE(SUM(CASE WHEN t.status = 'done' THEN 1 ELSE 0 END), 0) AS completed_tasks,
    COALESCE(SUM(CASE WHEN t.status = 'blocked' THEN 1 ELSE 0 END), 0) AS blocked_tasks,
    COALESCE(SUM(CASE WHEN t.status <> 'done' AND t.scheduled_end < NOW() THEN 1 ELSE 0 END), 0) AS overdue_tasks
FROM public.goals AS g
LEFT JOIN public.tasks AS t ON t.goal_id = g.id
GROUP BY g.id, g.user_id, g.title, g.domain, g.status, g.deadline, g.deviation;

CREATE OR REPLACE VIEW public.telova_schedule_pressure_view AS
SELECT
    g.id AS goal_id,
    g.user_id,
    g.title AS goal_title,
    g.status AS goal_status,
    t.id AS task_id,
    t.title AS task_title,
    t.phase,
    t.status AS task_status,
    t.estimated_minutes,
    t.scheduled_start,
    t.scheduled_end,
    (t.status <> 'done' AND t.scheduled_end IS NOT NULL AND t.scheduled_end < NOW()) AS is_overdue,
    (t.status = 'blocked') AS is_blocked,
    e.id AS calendar_event_id,
    e.title AS calendar_title,
    e.source AS calendar_source
FROM public.tasks AS t
INNER JOIN public.goals AS g ON g.id = t.goal_id
LEFT JOIN public.calendar_events AS e ON e.task_id = t.id;

CREATE OR REPLACE VIEW public.telova_agent_activity_view AS
SELECT
    ar.id AS agent_run_id,
    ar.user_id,
    ar.goal_id,
    ar.agent_name,
    ar.operation,
    ar.status,
    ar.runtime,
    ar.started_at,
    ar.completed_at,
    msl.tool_name,
    msl.operation AS sync_operation,
    msl.status AS sync_status,
    msl.created_at AS sync_created_at
FROM public.agent_runs AS ar
LEFT JOIN public.mcp_sync_logs AS msl
    ON msl.goal_id = ar.goal_id
   AND msl.user_id = ar.user_id;

CREATE OR REPLACE VIEW public.telova_goal_execution_secure AS
SELECT *
FROM public.telova_goal_execution_view
WHERE user_id = current_setting('telova.user_id', true);

CREATE OR REPLACE VIEW public.telova_schedule_pressure_secure AS
SELECT *
FROM public.telova_schedule_pressure_view
WHERE user_id = current_setting('telova.user_id', true);

CREATE OR REPLACE VIEW public.telova_agent_activity_secure AS
SELECT *
FROM public.telova_agent_activity_view
WHERE user_id = current_setting('telova.user_id', true);

COMMENT ON VIEW public.telova_goal_execution_secure IS
'One row per goal with productivity health metrics including overdue, blocked, and completed task counts.';
COMMENT ON VIEW public.telova_schedule_pressure_secure IS
'One row per task with schedule timing, overdue state, blocked state, and linked calendar context.';
COMMENT ON VIEW public.telova_agent_activity_secure IS
'Recent Telova agent executions and MCP sync activity for the authenticated workspace user.';

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_extension
        WHERE extname = 'alloydb_ai_nl'
    ) THEN
        RAISE NOTICE
            'Skipping AlloyDB AI natural language configuration because the extension is not installed.';
        RETURN;
    END IF;

    BEGIN
        PERFORM alloydb_ai_nl.g_create_configuration('telova_nl');
    EXCEPTION
        WHEN OTHERS THEN
            RAISE NOTICE 'Configuration telova_nl may already exist or could not be created: %', SQLERRM;
    END;

    BEGIN
        PERFORM alloydb_ai_nl.g_manage_configuration(
            operation => 'register_table_view',
            configuration_id_in => 'telova_nl',
            table_views_in => '{public.telova_goal_execution_secure,public.telova_schedule_pressure_secure,public.telova_agent_activity_secure}'
        );
    EXCEPTION
        WHEN OTHERS THEN
            RAISE NOTICE 'Table/view registration skipped: %', SQLERRM;
    END;

    BEGIN
        PERFORM alloydb_ai_nl.g_manage_configuration(
            'add_general_context',
            'telova_nl',
            general_context_in => $json${
              "Telova is a multi-agent productivity assistant. Goals contain tasks and calendar blocks. A task is overdue when it is not done and the scheduled end time is in the past. A goal is at risk when deviation is high or when it has blocked or overdue tasks. Questions about today's work usually refer to scheduled tasks or calendar blocks for the current day."
            }$json$
        );
    EXCEPTION
        WHEN OTHERS THEN
            RAISE NOTICE 'General context skipped: %', SQLERRM;
    END;

    BEGIN
        PERFORM alloydb_ai_nl.add_template(
            nl_config_id => 'telova_nl',
            intent => 'Which active goals have overdue tasks?',
            sql => $sql$SELECT goal_title, overdue_tasks, blocked_tasks, deviation, deadline
                         FROM public.telova_goal_execution_secure
                         WHERE goal_status = 'active' AND overdue_tasks > 0
                         ORDER BY overdue_tasks DESC, deadline ASC$sql$,
            parameterized_sql => $sql$SELECT goal_title, overdue_tasks, blocked_tasks, deviation, deadline
                         FROM public.telova_goal_execution_secure
                         WHERE goal_status = 'active' AND overdue_tasks > 0
                         ORDER BY overdue_tasks DESC, deadline ASC$sql$,
            parameterized_intent => 'Which active goals have overdue tasks?',
            manifest => 'Which active goals have overdue tasks?',
            check_intent => FALSE
        );
    EXCEPTION
        WHEN OTHERS THEN
            RAISE NOTICE 'Template "Which active goals have overdue tasks?" skipped: %', SQLERRM;
    END;

    BEGIN
        PERFORM alloydb_ai_nl.add_template(
            nl_config_id => 'telova_nl',
            intent => 'What is due today?',
            sql => $sql$SELECT goal_title, task_title, phase, task_status, scheduled_start, scheduled_end
                         FROM public.telova_schedule_pressure_secure
                         WHERE scheduled_start >= date_trunc('day', NOW())
                           AND scheduled_start < date_trunc('day', NOW()) + interval '1 day'
                         ORDER BY scheduled_start ASC$sql$,
            parameterized_sql => $sql$SELECT goal_title, task_title, phase, task_status, scheduled_start, scheduled_end
                         FROM public.telova_schedule_pressure_secure
                         WHERE scheduled_start >= date_trunc('day', NOW())
                           AND scheduled_start < date_trunc('day', NOW()) + interval '1 day'
                         ORDER BY scheduled_start ASC$sql$,
            parameterized_intent => 'What is due today?',
            manifest => 'What is due today?',
            check_intent => FALSE
        );
    EXCEPTION
        WHEN OTHERS THEN
            RAISE NOTICE 'Template "What is due today?" skipped: %', SQLERRM;
    END;

    BEGIN
        PERFORM alloydb_ai_nl.add_template(
            nl_config_id => 'telova_nl',
            intent => 'Which tasks are blocked?',
            sql => $sql$SELECT goal_title, task_title, phase, task_status, scheduled_end
                         FROM public.telova_schedule_pressure_secure
                         WHERE is_blocked = TRUE
                         ORDER BY scheduled_end ASC NULLS LAST$sql$,
            parameterized_sql => $sql$SELECT goal_title, task_title, phase, task_status, scheduled_end
                         FROM public.telova_schedule_pressure_secure
                         WHERE is_blocked = TRUE
                         ORDER BY scheduled_end ASC NULLS LAST$sql$,
            parameterized_intent => 'Which tasks are blocked?',
            manifest => 'Which tasks are blocked?',
            check_intent => FALSE
        );
    EXCEPTION
        WHEN OTHERS THEN
            RAISE NOTICE 'Template "Which tasks are blocked?" skipped: %', SQLERRM;
    END;

    BEGIN
        PERFORM alloydb_ai_nl.add_template(
            nl_config_id => 'telova_nl',
            intent => 'Which goal has the highest deviation from plan?',
            sql => $sql$SELECT goal_title, domain, deviation, deadline, overdue_tasks, blocked_tasks
                         FROM public.telova_goal_execution_secure
                         ORDER BY deviation DESC, overdue_tasks DESC
                         LIMIT 5$sql$,
            parameterized_sql => $sql$SELECT goal_title, domain, deviation, deadline, overdue_tasks, blocked_tasks
                         FROM public.telova_goal_execution_secure
                         ORDER BY deviation DESC, overdue_tasks DESC
                         LIMIT 5$sql$,
            parameterized_intent => 'Which goal has the highest deviation from plan?',
            manifest => 'Which goal has the highest deviation from plan?',
            check_intent => FALSE
        );
    EXCEPTION
        WHEN OTHERS THEN
            RAISE NOTICE 'Template "Which goal has the highest deviation from plan?" skipped: %', SQLERRM;
    END;

    BEGIN
        PERFORM alloydb_ai_nl.add_template(
            nl_config_id => 'telova_nl',
            intent => 'What did the agents do recently?',
            sql => $sql$SELECT agent_name, operation, status, runtime, started_at, sync_operation, sync_status
                         FROM public.telova_agent_activity_secure
                         ORDER BY started_at DESC
                         LIMIT 10$sql$,
            parameterized_sql => $sql$SELECT agent_name, operation, status, runtime, started_at, sync_operation, sync_status
                         FROM public.telova_agent_activity_secure
                         ORDER BY started_at DESC
                         LIMIT 10$sql$,
            parameterized_intent => 'What did the agents do recently?',
            manifest => 'What did the agents do recently?',
            check_intent => FALSE
        );
    EXCEPTION
        WHEN OTHERS THEN
            RAISE NOTICE 'Template "What did the agents do recently?" skipped: %', SQLERRM;
    END;

    BEGIN
        PERFORM alloydb_ai_nl.add_fragment(
            nl_config_id => 'telova_nl',
            table_aliases => ARRAY['public.telova_schedule_pressure_secure AS T'],
            intent => 'tasks due tomorrow',
            parameterized_intent => 'tasks due tomorrow',
            fragment => $sql$T.scheduled_start >= date_trunc('day', NOW()) + interval '1 day'
                            AND T.scheduled_start < date_trunc('day', NOW()) + interval '2 day'$sql$,
            parameterized_fragment => $sql$T.scheduled_start >= date_trunc('day', NOW()) + interval '1 day'
                            AND T.scheduled_start < date_trunc('day', NOW()) + interval '2 day'$sql$,
            manifest => 'tasks due tomorrow',
            check_intent => FALSE
        );
    EXCEPTION
        WHEN OTHERS THEN
            RAISE NOTICE 'Fragment "tasks due tomorrow" skipped: %', SQLERRM;
    END;

    BEGIN
        PERFORM alloydb_ai_nl.add_fragment(
            nl_config_id => 'telova_nl',
            table_aliases => ARRAY['public.telova_goal_execution_secure AS T'],
            intent => 'goals at risk',
            parameterized_intent => 'goals at risk',
            fragment => $sql$T.deviation >= 0.20 OR T.overdue_tasks > 0 OR T.blocked_tasks > 0$sql$,
            parameterized_fragment => $sql$T.deviation >= 0.20 OR T.overdue_tasks > 0 OR T.blocked_tasks > 0$sql$,
            manifest => 'goals at risk',
            check_intent => FALSE
        );
    EXCEPTION
        WHEN OTHERS THEN
            RAISE NOTICE 'Fragment "goals at risk" skipped: %', SQLERRM;
    END;

    BEGIN
        PERFORM alloydb_ai_nl.add_fragment(
            nl_config_id => 'telova_nl',
            table_aliases => ARRAY['public.telova_schedule_pressure_secure AS T'],
            intent => 'completed tasks',
            parameterized_intent => 'completed tasks',
            fragment => $sql$T.task_status = 'done'$sql$,
            parameterized_fragment => $sql$T.task_status = 'done'$sql$,
            manifest => 'completed tasks',
            check_intent => FALSE
        );
    EXCEPTION
        WHEN OTHERS THEN
            RAISE NOTICE 'Fragment "completed tasks" skipped: %', SQLERRM;
    END;
END $$;
