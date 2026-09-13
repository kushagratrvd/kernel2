import { createAccessControl } from "better-auth/plugins/access";

export const statement = {
    contest: ["create", "update", "delete", "view"],
    question: ["create", "update", "submit_for_review", "view"],
    review: ["pick_up", "approve", "reject", "request_changes", "comment"],
    submission: ["create", "view"],
    user: ["manage_roles", "deactivate"],
    category: ["create", "update", "delete", "view"],
} as const;

export const ac = createAccessControl(statement);

export const student = ac.newRole({ 
    contest: ["view"], 
    submission: ["create", "view"],
}); 

export const creator = ac.newRole({
    question: ["create", "update", "submit_for_review", "view"],
    review: ["comment"],
    category: ["view"],
    contest: ["view"],
    submission: ["view"],
});

export const reviewer = ac.newRole({
    review: ["pick_up", "approve", "reject", "request_changes", "comment"],
    question: ["view"],
    category: ["view"],
    contest: ["view"],
    submission: ["view"],
});

export const admin = ac.newRole({ 
    contest: ["create", "update", "delete", "view"],
    question: ["create", "update", "submit_for_review", "view"],
    review: ["pick_up", "approve", "reject", "request_changes", "comment"],
    submission: ["create", "view"],
    user: ["manage_roles", "deactivate"],
    category: ["create", "update", "delete", "view"],
});