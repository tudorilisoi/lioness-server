const {
  PROJECT_STATUESES: { STATUS_IN_PROGRESS },
  USER_SELECT_FIELDS,
  FETCH_INFO: { SORT_ASC, SORT_DESC, ITEMS_PER_PAGE },
  ROLES: { ADMIN_ROLE, CLIENT_ROLE, MANAGER_ROLE, CONTRACTOR_ROLE }
} = require("../config");

const populateUserProjects = async (user, knex) => {
  const promises = [];
  const roleQuery = knex("roles")
    .select("*")
    .where("id", user.role_id)
    .first();
  const roleObj = roleQuery.then(res => {
    user.role = res;
  });
  promises.push(roleObj);

  //this will either be client projects or user projects
  user.projects = [];

  //populate client projects
  if (user.role_id === CLIENT_ROLE) {
    const clientProjectsQuery = knex("projects")
      .select("*")
      .where("client_id", user.id);
    const clientProjectPromise = clientProjectsQuery.then(project => {
      user.projects = project;
    });
    promises.push(clientProjectPromise);
  }

  if (user.role_id === MANAGER_ROLE) {
    const managerProjectsQuery = knex("projects")
      .select("*")
      .where("manager_id", user.id);

    const managerProjectPromise = managerProjectsQuery.then(projects => {
      user.projects = projects;
    });
    promises.push(managerProjectPromise);
  }
  if (user.role_id === CONTRACTOR_ROLE) {
    const contractorsProjectsQuery = knex("projects")
      .select("*")
      // .where('project_id', id)
      .innerJoin("contractors_projects", function () {
        this.on("projects.id", "=", "contractors_projects.project_id").andOn(
          "contractors_projects.contractor_id",
          "=",
          user.id
        );
      });




    const contractorsProjectsPromise = contractorsProjectsQuery.then(
      projects => {
        user.projects = projects;
      }
    );

    promises.push(contractorsProjectsPromise);
  }
  return Promise.all(promises);
};

const UsersService = {
  getUserByID: async (knex, id) => {
    const user = await knex("users")
      .select(USER_SELECT_FIELDS)
      .where("id", "=", id)
      .first();
    await populateUserProjects(user, knex);
    return user;
  },
  upsertUser: async (knex, user) => {
    // nullify empty values
    Object.keys(user).forEach(k => {
      if (user[k] === "") {
        user[k] = null;
      }
    });

    let { id } = user;
    const isNew = id === -1;
    delete user.id;

    if (isNew) {
      let q = knex("users").insert(user, ["id"]);


      await q.then(returnedInfo => {
        id = returnedInfo[0].id; //the INSERT ID
        return returnedInfo;
      });
    } else {
      await knex("users")
        .where("id", "=", id)
        .update(user)
        .then(returnedInfo => {
          return returnedInfo;
        });
    }
    return UsersService.getUserByID(knex, id);
  },
  deleteUser: async (knex, id) => {
    return knex("users")
      .where("id", "=", id)
      .update("inactive", true)
      .then(res => {
        return res;
      });
  },
  getUsers: async (knex, mergedOpts) => {
    let users = knex("users")

    const counter = knex("users");

    if (mergedOpts.roleFilter) {
      users.where("role_id", mergedOpts.roleFilter);
      counter.where("role_id", mergedOpts.roleFilter);
      switch (+mergedOpts.roleFilter) {
        case CONTRACTOR_ROLE:
          users.select([
            ...USER_SELECT_FIELDS,
            knex.raw("count(projects.id) as active_projects")
          ])
          users.joinRaw(`
          LEFT JOIN 
          contractors_projects on users.id = contractors_projects.contractor_id 
          LEFT JOIN projects on projects.status_id=${STATUS_IN_PROGRESS} AND projects.id = contractors_projects.project_id`)
            .groupBy("users.id")
          if (mergedOpts.activeProjSort) {
            users.orderBy("active_projects", mergedOpts.activeProjSort);
          }
          break;
        case MANAGER_ROLE:
          users.select([
            ...USER_SELECT_FIELDS,
            knex.raw("count(projects.id) as active_projects")
          ])
          users.joinRaw(`           
              LEFT JOIN projects on projects.status_id=${STATUS_IN_PROGRESS} AND projects.manager_id = users.id`)
            .groupBy("users.id")
          if (mergedOpts.activeProjSort) {
            users.orderBy("active_projects", mergedOpts.activeProjSort);
          }
          break;
        case CLIENT_ROLE:
          users.select([
            ...USER_SELECT_FIELDS,
            knex.raw("count(projects.id) as active_projects")
          ])
          users.joinRaw(`           
              LEFT JOIN projects on projects.status_id=${STATUS_IN_PROGRESS} AND projects.client_id = users.id`)
            .groupBy("users.id")
          if (mergedOpts.activeProjSort) {
            users.orderBy("active_projects", mergedOpts.activeProjSort);
          }
          break;

        default:
          users
            .select([
              ...USER_SELECT_FIELDS,
            ])
          break;
      }
    }
    if (mergedOpts.searchQuery) {
      users
        .where("full_name", "ilike", `%${mergedOpts.searchQuery}%`)
        .orWhere("email", "ilike", `%${mergedOpts.searchQuery}%`);
      counter
        .where("full_name", "ilike", `%${mergedOpts.searchQuery}%`)
        .orWhere("email", "ilike", `%${mergedOpts.searchQuery}%`);

    }
    let totalItemCount = +(await counter.count("id"))[0].count;
    const numPages = Math.ceil(totalItemCount / ITEMS_PER_PAGE);

    if (mergedOpts.userNameSort) {
      users.orderBy("full_name", mergedOpts.userNameSort);
    }



    const begin = (mergedOpts.pageNumber - 1) * ITEMS_PER_PAGE;
    users.where("inactive", false);
    users.offset(begin);
    users.limit(ITEMS_PER_PAGE);


    let result = [];
    console.log(users.toString())
    await users
      .then(data => {
        result = data;
      });

    let promises = [];
    result.forEach(user => promises.push(populateUserProjects(user, knex)));
    await Promise.all(promises);
    return {
      data: result,
      numPages,
      totalItemCount,
      params: mergedOpts
    };
  }
};
module.exports = UsersService;
