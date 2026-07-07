import { createAccessControl } from "better-auth/plugins/access";

export const statement = {
    contest: ["create", "update", "delete", "view"],
    submission: ["create", "view"]
} as const;

export const ac = createAccessControl(statement);

export const student = ac.newRole({ 
    contest: ["view"], 
    submission: ["create", "view"] 
}); 

export const admin = ac.newRole({ 
    contest: ["create", "update", "delete", "view"],
    submission: ["create", "view"]
});