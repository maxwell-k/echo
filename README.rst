====
echo
====

A repository to demonstrate GitLab CI/CD and:

-   `botbuilder <https://github.com/Microsoft/BotBuilder>`__  as a framework
    with
-   `BotTester <https://github.com/microsoftly/BotTester>`__ for testing,
-   `bunyan <https://github.com/trentm/node-bunyan>`__ for logging and
-   Microsoft Azure App Service as a platform

There are four steps in configuring a publicly accessible GitLab repository to
deploy onto a Microsoft Azure App Service. The fifth step is optional.

#.  Name: find a suitable unique name
#.  Register: with Microsoft
#.  Resource: create resources and deploy the echo bot
#.  Deploy: code from a git repository and configure automatic deployments
#.  Remove: destroy any resources that were created during this demo

These instructions assume that the following command line tools are available:
``az``, ``curl`` and ``jq``.

Name
----

At least some of these names have to be unique. The following creates unique
names as "demo-", entity type, "-", and then five random characters.

.. code:: sh

    suffix=$(</dev/urandom tr -dc 'a-z' | head -c 5) &&
    resourceGroup=demo-resource-group-$suffix &&
    deployment=demo-deployment-$suffix &&
    bot=demo-bot-$suffix &&
    plan=demo-plan-$suffix &&
    storage=demostorage$suffix &&
    unset suffix &&
    printf 'resource group: %s deployment: %s bot: %s\n' \
        $resourceGroup $deployment $bot &&
    az storage account check-name --name $storage

If the last command shows that the storage account name is not available, run
these commands again.

The variables above must be configured before any of the subsequent steps.

Register
--------

#.  Visit https://apps.dev.microsoft.com/#/appList and create an app
    registration, using ``$bot`` as the name
#.  Note the id and generate a password; no other options are required.
    Set two environment variables to use these details later::

        appId=
        password=''

#.  Optionally remove any delegated permissions.

The Microsoft documentation only supports registering an application through
the Azure Portal GUI. The quick-start automatically registers an application

Resource
--------

Create a resource group:

.. code:: sh

    az group create --name $resourceGroup --location ukwest &&
    az group list

This group will later be used to delete the resources.

Create an app service plan:

.. code:: sh

    az appservice plan create \
        --name $plan --resource-group $resourceGroup --location ukwest &&
    planId=$(
        az appservice plan list --resource-group $resourceGroup \
        --query '[].id|[0]' | tr -d '"'
    ) && echo $planId

Deploy the echo bot:

.. code:: sh

    az group deployment create \
      --resource-group "$resourceGroup" \
      --template-file template.json \
      --parameters "@parameters.json" \
      --parameters "location=UK West" \
      --parameters "botId=$bot" \
      --parameters "siteName=$bot" \
      --parameters "serverFarmId=$planId" \
      --parameters "storageAccountName=$storage" \
      --parameters "appId=$appId" \
      --parameters "appSecret=$password"

Optionally log into the portal, view the Web App Bot and "Test in Web Chat".

Optionally turn on logging and follow the logs in a terminal:

.. code:: sh

    az webapp log config \
        --name $bot --resource-group $resourceGroup \
        --web-server-logging filesystem
    az webapp log tail --name $bot --resource-group $resourceGroup

Deploy
------

Configure the Azure web app to deploy from that repository:

.. code:: sh

    az webapp deployment source config \
        --name $bot --resource-group $resourceGroup \
        --branch master \
        --manual-integration \
        --repo-url git@gitlab.com:keith.maxwell/botops.git \
        --repository-type git

Then:

-   add the public ssh deploy key to GitLab and
-   configure the web hook URL

Deploy key
~~~~~~~~~~

The deploy key changes every time you change a deploy source.

To deploy from a private repository the `Kudu` public key must be added to
GitLab. The key is available through a browser that is logged in to the Azure
portal, calculate the URL from:

.. code::

    printf 'https://%s.scm.azurewebsites.net/api/sshkey?ensurePublicKey=1\n' \
        $bot

Take the value without quotation marks and add it to the GitLab "Deploy Keys"
under "Repository" in "Settings" (``/settings/repository``).
Visit the URL several times to avoid a `kudu issue`_, it may also be necessary
to debug with the `Kudu` PowerShell prompt.

.. _kudu issue: https://github.com/projectkudu/kudu/issues/2279


Web Hook
~~~~~~~~

Then browse to `GitLab repository → Settings → Integrations <https://
gitlab.com/keith.maxwell/echo/settings/integrations>`__ and add the following
URL:

.. code:: sh

    password=$(az webapp deployment list-publishing-profiles \
        --name $bot --resource-group $resourceGroup \
        --query '[0].userPWD' \
        | tr -d '"') &&
    printf 'https://$%s:%s@%s.scm.azurewebsites.net/deploy\n' \
        $bot "$password" $bot


Start following the log again and test a push event from the above GitLab page.
You should see a post to ``/deploy``. Keep watching the log and push a commit
to the repository. Then list the deployments with:

.. code:: sh

    printf 'url https://$%s:%s@%s.scm.azurewebsites.net/api/deployments' \
        $bot "$password" $bot |
    curl -K - | jq .

Remove
------

Remove the demo and check that the resource group does not exist:

.. code:: sh

    az group delete --name $resourceGroup
    az group list

Visit https://apps.dev.microsoft.com/#/appList and delete the app.

Other commands
--------------

To remove an existing deployment setup:

.. code:: sh

    az webapp deployment source delete \
        --name $bot --resource-group $resourceGroup
    az webapp deployment source show \
        --name $bot --resource-group $resourceGroup

To show information about the deployment configuration:

.. code:: sh

    az webapp deployment source show \
        --name $bot --resource-group $resourceGroup

To understand the deployment history:

.. code:: sh

    az webapp log download --resource-group $resourceGroup --name $bot

To get details about the app:

.. code:: sh

    az webapp show \
        --resource-group $resourceGroup --name $bot

References
----------

-   https://github.com/projectkudu/kudu/wiki/Continuous-deployment
-   https://github.com/projectkudu/kudu/wiki/Deployment-credentials
-   `Christian Liebel's blog post <https://christianliebel.com/2016/05/
    auto-deploying-to-azure-app-services-from-gitlab/>`__

Originally based on the hello sample from Microsoft:

.. code:: sh

    printf 'remote-name\nurl %s/%s' \
    'https://raw.githubusercontent.com/Microsoft/BotBuilder' \
    'master/Node/examples/hello-ChatConnector/app.js' \
    | curl -K -

.. Footnotes

.. [1] The web hook or deployment trigger URL is also under App Service →
    Settings → Properties
