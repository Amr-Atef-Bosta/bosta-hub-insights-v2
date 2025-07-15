/*
  # Seed data for Bosta Insight Hub v2

  1. Agent Prompts
    - Default system prompts for each AI agent
    - Model configurations and tool assignments

  2. Demo Users
    - Test users for each role type
    - Default passwords for development

  3. Default Settings
    - PII column configurations
    - Cache settings
    - Feature flags

  4. Table Access Control
    - Default role-based permissions
*/

-- Insert default agent prompts
INSERT IGNORE INTO agent_prompts (agent_name, system_prompt, model, tools) VALUES
('AnalystAgent', 'You are Bosta\'s logistics data analyst. Mission: make MENA last-mile deliveries seamless and transparent. If the requested column is tagged as PII and user role ≠ admin, mask it or refuse. Always return the SQL you executed in a markdown code-block. Be concise but thorough in your analysis.', 'gpt-4.1-latest', '["SQLTool", "MongoTool", "MaskPII"]'),

('VisualizerAgent', 'You are a data visualization specialist for Bosta logistics. Create clear, compelling charts and graphs that tell the story of the data. Focus on logistics KPIs like delivery rates, order volumes, and performance metrics. Always explain what the visualization shows and key insights.', 'gpt-3.5-turbo-0125', '["MakeChart", "SQLTool"]'),

('ForecasterAgent', 'You are a forecasting expert for Bosta logistics operations. Analyze time-series data to predict trends in orders, deliveries, and operational metrics. Provide confidence intervals and explain your methodology. Focus on actionable insights for logistics planning.', 'gpt-4.1-latest', '["SQLTool", "ForecastTool", "MakeChart"]'),

('AMCopilotAgent', 'You are an Account Manager copilot for Bosta. Help AMs understand client performance, identify opportunities, and draft communications. Focus on client-specific metrics, delivery performance, and relationship insights. Always maintain a professional, client-focused tone.', 'gpt-4.1-latest', '["SQLTool", "HealthScore", "EmailDraft"]'),

('SupervisorAgent', 'You are the supervisor agent that routes user queries to the most appropriate specialist agent. Analyze the user\'s request and determine whether it needs data analysis, visualization, forecasting, or AM support. Route accordingly and provide context to the selected agent.', 'gpt-4.1-mini', '["RouteToAgent"]');

-- Insert demo users
INSERT IGNORE INTO users (email, name, role, password_hash) VALUES
('admin@bosta.co', 'System Administrator', 'admin', '$2b$10$xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx'),
('leader@bosta.co', 'Team Leader', 'leader', '$2b$10$xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx'),
('am@bosta.co', 'Account Manager', 'am', '$2b$10$xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx'),
('analyst@bosta.co', 'Data Analyst', 'analyst', '$2b$10$xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx');

-- Insert default table access patterns
INSERT IGNORE INTO table_access (role, table_pattern) VALUES
('admin', '*'),
('leader', '*'),
('am', 'orders'),
('am', 'clients'),
('am', 'delivery_stats'),
('am', 'client_metrics'),
('analyst', 'orders'),
('analyst', 'delivery_stats'),
('analyst', 'hr_%'),
('analyst', 'operational_metrics');

-- Insert default settings
INSERT IGNORE INTO settings (setting_key, setting_value) VALUES
('pii_columns', '["customer_phone", "customer_email", "driver_phone", "customer_address", "customer_name"]'),
('cache_ttl', '3600'),
('feature_flags', '{"whatsapp_enabled": false, "dashboard_enabled": false, "templates_enabled": false}'),
('max_query_rows', '5000'),
('query_timeout', '8000');