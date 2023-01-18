import * as core from "@actions/core";
import * as github from "@actions/github";
import * as http from "@actions/http-client"
import Auth from "@actions/http-client/lib/auth.js";

const validStates = ["success"]
const invalidStates = ["failure", "canceled"]
const finalStates = [...validStates, ...invalidStates]

function delay(seconds) {
  return new Promise(resolve => setTimeout(resolve, seconds * 1000));
}

try {
  const orgID = core.getInput('orgID')
  const projectID = core.getInput('projectID')
  const target = core.getInput('target')
  const buildID = core.getInput('buildID').trim()
  const apiKey = core.getInput("apiKey")
  const auth = new Auth.BasicCredentialHandler(apiKey, "")
  const httpClient = new http.HttpClient(null, [ auth ]);
  const waitTime = core.getInput("waitTime");

  if (buildID.length === 0) {
    throw new Error("Missing Build ID")
  }

  const url = `https://${apiKey}@build-api.cloud.unity3d.com/api/v1/orgs/${orgID}/projects/${projectID}/buildtargets/${target}/builds/${buildID}`

  let attempt = 0;
  let build

  while(true) {
    ++attempt;
    const response = await core.group(`Get Build Information (${attempt})`, async () => {
      console.log(url)
      return await httpClient.getJson(url);
    })

    build = response.result

    console.dir(response)
    if (finalStates.includes(build.buildStatus))
      break;

    await delay(waitTime)
  }

  const { buildStatus } = build;
  // Get the JSON webhook payload for the event that triggered the workflow
  const payload = JSON.stringify(github.context.payload, undefined, 2)
  console.log(`The event payload: ${payload}`);
  console.dir(build);
  core.setOutput("status", buildStatus)
  core.setOutput("build", build)

  if (validStates.includes(buildStatus)) {
    core.saveState("build", build)
    core.setOutput("download_url", build.links.download_primary.href)
  } else {
    core.setFailed(`${buildStatus} is not valid status`)
  }
} catch (error) {
  core.setFailed(error);
}
