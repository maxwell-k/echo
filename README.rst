====
echo
====

A repository to demonstrate deploying a botbuilder_ chat bot onto Microsoft
Azure App Service as a platform programmatically.

.. _botbuilder: https://github.com/Microsoft/BotBuilder

There are four steps in configuring a GitLab repository to
deploy onto a Microsoft Azure App Service. The fifth step is optional.

#.  Name: find a suitable unique name
#.  Register: with Microsoft
#.  Resource: create resources and deploy the echo bot
#.  Deploy: code from a git repository and configure automatic deployments
#.  Remove: destroy any resources that were created

These instructions assume that the following command line tools are available:
``az``, ``curl`` and ``jq``.

Name
----

At least some of these names have to be unique. The following creates unique
names as "prototype-", entity type, "-", and then five random characters.

.. code:: sh

    suffix=$(</dev/urandom tr -dc 'a-z' | head -c 5) &&
    resourceGroup=prototype-resource-group-$suffix &&
    deployment=prototype-deployment-$suffix &&
    bot=prototype-bot-$suffix &&
    plan=prototype-plan-$suffix &&
    storage=prototypestorage$suffix &&
    unset suffix &&
    printf 'resource group: %s deployment: %s bot: %s\n' \
        $resourceGroup $deployment $bot &&
    az storage account check-name --name $storage

If the last command shows that the storage account name is not available, run
these commands again.

The environment variables above must be set before any of the subsequent steps.

Register
--------

#.  Visit https://apps.dev.microsoft.com/#/appList and create an app
    registration, using ``$bot`` as the name
#.  Note the id and generate a new password; no other options are required.
    Set two environment variables to use these details later::

        appId=<long string under Application Id on web page>
        appSecret='<password from Generate New Password dialog>'

#.  Optionally remove any delegated permissions.

Outside of the Azure web portal, Microsoft only reliably supports registering
an application through the Azure Portal GUI, see this comment_ on a GitHub
issue. The quick-start through the Azure web portal automatically registers an
application.

.. _comment: https://
    github.com/Microsoft/botbuilder-tools/issues/183#issuecomment-393274244

Resource
--------

Create a resource group:

.. code:: sh

    az group create --name $resourceGroup --location ukwest &&
    az group list

This group will later be used to delete the resources. Then create an app
service plan:

.. code:: sh

    az appservice plan create \
        --name $plan --resource-group $resourceGroup --location ukwest &&
    planId=$(
        az appservice plan list --resource-group $resourceGroup \
        --query '[].id|[0]' | tr -d '"'
    ) && echo $planId

Deploy ``node.js-abs-webapp_hello-chatconnector`` from Microsoft, with the
command below. First make sure ``parameters.json`` and ``template.json`` from
this repository are available in the current directory.

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
      --parameters "appSecret=$appSecret"

Optionally log into the portal, view the Web App Bot and "Test in Web Chat".

For the following optional step you may prefer to  open another terminal.
Don't forget to copy across the environment variables, which you can display
with::

    set | grep "='prototype"

Optionally turn on logging and follow the logs in a terminal

.. code:: sh

    az webapp log config \
        --name $bot --resource-group $resourceGroup \
        --web-server-logging filesystem &&
    az webapp log tail --name $bot --resource-group $resourceGroup

Deploy
------

Configure the Azure web app to deploy from a private GitLab repository. The
command will exit with "Deployment failed".

.. code:: sh

    az webapp deployment source config \
        --name $bot --resource-group $resourceGroup \
        --repository-type git \
        --repo-url git@gitlab.com:keith.maxwell/echo-private.git \
        --branch master \
        --manual-integration

Then, following the instructions below:

1.  Add the public ssh deploy key to GitLab so that Azure can access the
    source code and
2.  Configure the web hook in GitLab so that Azure is notified of changes

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
URL for "push events":

.. code:: sh

    password=$(az webapp deployment list-publishing-profiles \
        --name $bot --resource-group $resourceGroup \
        --query '[0].userPWD' \
        | tr -d '"') &&
    printf 'https://$%s:%s@%s.scm.azurewebsites.net/deploy\n' \
        $bot "$password" $bot

Further down the GitLab page there is the option to test the web hook with a
push event. This should show a "202" message in the web browser.
You can also list the deployments with ``curl`` at the command line:

.. code:: sh

    printf 'url https://$%s:%s@%s.scm.azurewebsites.net/api/deployments' \
        $bot "$password" $bot | curl -K - | jq .

Remove
------

Remove all of the resources and check that the resource group no longer
exists:

.. code:: sh

    az group delete --name $resourceGroup &&
    az group list

Visit https://apps.dev.microsoft.com/#/appList and delete the app.

Other commands
--------------

To remove the existing deployment source:

.. code:: sh

    az webapp deployment source delete \
        --name $bot --resource-group $resourceGroup

To show information about the current deployment source including the
repository and branch:

.. code:: sh

    az webapp deployment source show \
        --name $bot --resource-group $resourceGroup

To download the logs:

.. code:: sh

    az webapp log download --resource-group $resourceGroup --name $bot

To get details about the app:

.. code:: sh

    az webapp show \
        --resource-group $resourceGroup --name $bot

To trigger a re-deployment manually:

.. code:: sh

    az webapp deployment source sync \
        --name $bot --resource-group $resourceGroup

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
