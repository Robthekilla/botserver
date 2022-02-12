import { Lists, ScriptRelateToOneForUpdateInput } from ".keystone/types";
import { createAuth } from "@keystone-6/auth";
import { config, graphql, list } from "@keystone-6/core";
import { checkbox, integer, json, password, relationship, select, text, timestamp, virtual } from "@keystone-6/core/fields";
import { statelessSessions } from "@keystone-6/core/session";
import { getConsoleContent, startScript, stopScript } from "./modules/sandbox";

function isAdmin({ session }: { session?: Session }) {
    return !!session && session.data.isAdmin;
}

function validated({ session }: { session?: Session }) {
    return !!session && session.data.validated;
}

function fieldIsSelf({ session, item }: { session?: Session, item: Lists.User.Item }) {
    if (!session) {
        return false;
    }
    return session.data.id === item.id;
}

function fieldIsAdmin({ session }: { session?: Session }) {
    if (!session) {
        return false;
    }
    return session.data.isAdmin;
}

function filterIsAdminOrSelf({ session }: { session?: Session }) {
    if (!session) {
        return false;
    }
    if (session.data.isAdmin) {
        return true;
    }
    return { id: { equals: session.data.id } };
}

const User: Lists.User = list({
    access: {
        filter: {
            update: filterIsAdminOrSelf,
            delete: filterIsAdminOrSelf,
        },
    },
    fields: {
        name: text({
            validation: { isRequired: true, length: { max: 50 } },
            isIndexed: "unique",
            graphql: { create: { isNonNull: true }, read: { isNonNull: true } },
            access: { update: fieldIsAdmin },
        }),
        password: password({
            validation: { isRequired: true, length: { max: 50 }, rejectCommon: true },
            access: { read: () => false, update: fieldIsSelf },
            isFilterable: false,
            isOrderable: false,
        }),
        validated: checkbox({
            defaultValue: false,
            graphql: { read: { isNonNull: true } },
            access: { create: fieldIsAdmin, update: fieldIsAdmin },
        }),
        isAdmin: checkbox({
            defaultValue: false,
            graphql: { read: { isNonNull: true } },
            access: { create: fieldIsAdmin, update: fieldIsAdmin },
        }),
        scripts: relationship({
            ref: "Script.author",
            many: true,
            graphql: { omit: ["create", "update"] },
            access: { create: () => false, update: () => false },
        }),
    },
});

const Script: Lists.Script = list({
    access: {
        filter: {
            update: ({ session }: { session?: Session }) => !!session && { author: { id: { equals: session.data.id } } },
            delete: filterIsAdminOrSelf,
        },
        operation: {
            create: validated,
            update: validated,
            query: validated,
            delete: validated,
        },
    },
    hooks: {
        resolveInput: ({ operation, item, resolvedData }) => {
            if (resolvedData.language == undefined && resolvedData.source == undefined) {
                return resolvedData;
            }

            if (resolvedData.language === undefined && resolvedData.source === undefined) {
                return resolvedData;
            }

            const language = (resolvedData.language ?? item?.language)!;
            const source = (resolvedData.source ?? item?.source)!;
            const compiled: string = (() => {
                switch (language) {
                    case "js":
                        return source;

                    case "ts":
                        return source;

                    default:
                        return source;
                }
            })();

            return { ...resolvedData, compiled };
        },
    },
    fields: {
        name: text({
            validation: { isRequired: true, length: { max: 200 } },
            isIndexed: true,
            graphql: { create: { isNonNull: true }, read: { isNonNull: true } },
        }),
        author: relationship({
            ref: "User.scripts",
            graphql: { omit: ["update"] },
            access: {
                create: ({ context, inputData }) => (
                    inputData.author?.create === undefined &&
                    inputData.author?.connect?.id === (context.session as Session).data.id
                ),
                update: () => false,
            },
        }),
        language: select({
            type: "string",
            options: [
                { label: "TypeScript", value: "ts" },
                { label: "JavaScript", value: "js" },
            ],
            defaultValue: "ts",
            validation: { isRequired: true },
            graphql: { create: { isNonNull: true }, read: { isNonNull: true } },
        }),
        source: text({
            validation: { length: { max: 65536 } },
            graphql: { create: { isNonNull: true }, read: { isNonNull: true } },
            isFilterable: false,
            isOrderable: false,
            ui: { displayMode: "textarea" },
        }),
        compiled: text({
            validation: { length: { max: 65536 } },
            graphql: { omit: ["create", "update"], read: { isNonNull: true } },
            isFilterable: false,
            isOrderable: false,
            ui: { displayMode: "textarea" },
        }),
        created_at: timestamp({
            defaultValue: { kind: "now" },
            isIndexed: true,
            db: { isNullable: false },
            graphql: { read: { isNonNull: true }, omit: ["create", "update"] },
            access: { create: () => false, update: () => false, },
        }),
        updated_at: timestamp({
            isIndexed: true,
            db: { isNullable: false },
            graphql: { read: { isNonNull: true }, omit: ["create", "update"] },
            access: { create: () => false, update: () => false },
            hooks: {
                resolveInput: () => new Date().toISOString(),
            }
        }),
        bots: relationship({ ref: "Bot.script", many: true }),
    },
});

const Bot: Lists.Bot = list({
    access: {
        operation: {
            create: validated,
            update: validated,
            query: validated,
            delete: validated,
        },
    },
    hooks: {
        validateInput: ({ item, resolvedData, operation, addValidationError }) => {
            const on = resolvedData.on === true || resolvedData.on !== false && !!item?.on;
            if (!on) return;

            const hasScript = (() => {
                if (resolvedData.script?.create != null || resolvedData.script?.connect?.id != null) {
                    return true;
                }
                if (operation === "create") {
                    return false;
                } else {
                    const scriptInput = resolvedData.script as ScriptRelateToOneForUpdateInput | undefined;
                    if (scriptInput?.disconnect === true) {
                        return false;
                    }
                    return item!.scriptId != null;
                }
            })();
            if (!hasScript) {
                addValidationError("Turned on without a script");
            }
        },
        afterOperation: async ({ originalItem, item, context }) => {
            const turnOff = !!originalItem?.on;
            if (turnOff) {
                stopScript(originalItem.id);
            }

            const turnOn = !!item?.on;
            if (turnOn) {
                const script: string = (await context.query.Script.findOne({
                    where: { id: item.scriptId },
                    query: "compiled",
                })).compiled;
                startScript({
                    id: item.id,
                    script,
                    name: item.name,
                    auth: item.auth,
                    password: item.password,
                    parameter: item.parameter
                });
            }
        },
    },
    fields: {
        name: text({
            validation: { isRequired: true, length: { max: 200 } },
            isIndexed: "unique",
            graphql: { create: { isNonNull: true }, read: { isNonNull: true } },
        }),
        auth: select({
            type: "string",
            options: [
                { label: "Microsoft", value: "microsoft" },
                { label: "Mojang", value: "mojang" },
            ],
        }),
        password: text({
            validation: { length: { max: 200 } },
            isFilterable: false,
            isOrderable: false,
        }),
        script: relationship({ ref: "Script.bots" }),
        parameter: json({
            defaultValue: null,
        }),
        on: checkbox({
            defaultValue: false,
            graphql: { read: { isNonNull: true } },
        }),
        console: virtual({
            field: graphql.field({
                type: graphql.String,
                resolve: (item) => getConsoleContent(item.id),
            }),
            ui: {}
        }),
    },
});

const { withAuth } = createAuth({
    listKey: "User",
    identityField: "name",
    secretField: "password",
    sessionData: "id name isAdmin validated",
    initFirstItem: {
        fields: ["name", "password"],
        itemData: {
            validated: true,
            isAdmin: true,
        },
    },
});

type Session = {
    data: {
        id: string;
        name: string;
        isAdmin: boolean;
        validated: boolean;
    };
};

export default withAuth(config({
    db: { provider: "sqlite", url: "file:./app.db" },
    experimental: {
        generateNextGraphqlAPI: true,
        generateNodeAPI: true,
    },
    lists: { User, Script, Bot },
    session: statelessSessions({
        secret: "TODO == TODO == TODO == TODO == TODO == TODO", // TODO
        secure: false, // TODO
    }),
}));
