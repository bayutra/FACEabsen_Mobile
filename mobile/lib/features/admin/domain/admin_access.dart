




library;

const String roleEmployee = 'EMPLOYEE';
const String roleSupervisor = 'SUPERVISOR';
const String roleAdmin = 'ADMIN';
const String roleSuperAdmin = 'SUPER_ADMIN';

bool isSuperAdmin(List<String> roles) => roles.contains(roleSuperAdmin);


bool isAdmin(List<String> roles) =>
    roles.contains(roleAdmin) || isSuperAdmin(roles);



bool isSupervisor(List<String> roles) =>
    roles.contains(roleSupervisor) || isAdmin(roles);


bool canOpenAdminArea(List<String> roles) => isSupervisor(roles);



bool canManageAllEmployees(List<String> roles) => isAdmin(roles);
