pub mod commands;
pub mod settings;

// 注意：我们不能在这里导入 change_global_option，因为这会导致循环依赖
// 相反，我们会在需要的地方直接引用它
