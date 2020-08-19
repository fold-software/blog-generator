Você já acessou um site e viu nele vários botões de compartilhamento com números que indicam a quantidade de vezes que ele foi compartilhado? Ou viu uma página que incluia um mapa do Google? Esses são exemplos do uso de APIs para incluir serviços de outras empresas em suas páginas.

APIs ou *Application Programing Interfaces*, interface de programação de aplicativo em português, são maneiras de comunicação programática entre dois softwares, normalmente via web. As APIs foram essenciais para a evolução da internet e a criação da internet 2.0 e a ideia de Softwares como serviço, e ainda são a base da internet das coisas

# Mas e o que é uma API?

Uma API é uma interface, ou seja um combinado entre dois programas sobre como se comunicar. Uma API pode ser implementada de diversas maneiras, requisições HTTP, bibliotecas pré-compiladas, entre outros. 

![Diagrama do Funcionamento de APIs](diagrama-api.jpg)

A maior vantagem de uma API é a possibilidade de reutilização de serviços grandes e compartilhamento de informações sem que seja nescessário o conhecimento do funcionamento interno do serviço que mantem esses dados.

# Como posso usar uma API?

APIs são absolutamente nescessárias para o desenvolvimento de uma aplicação do mundo real. Existem milhares de APIs por ai a vantagem é que você não precisa conhecer e nem sequer saber usar todas elas, mas é uma boa se familiarizar com as mais comumente utilizadas.

O conhecimento de como algumas APIs funcionam também te ajuda a estruturar sua própria API caso isso seja algo que esteja fazendo. O planejamento e implementação de uma API é algo comum à vida de desenvolvedor.

# Tipos de API

APIs existem para diversos serviços e portanto são implementadas de diversas maneiras. As quatro principais arquiteturas atualmente utilizadas para distribuição de APIs públicas são REST, SOAP, GraphQL e SDKs*.

## REST

Uma arquitetura de API relativamente antiga, criada em 2000, mas ainda muito utilizada, a arquitetura REST, ou ***RE**presentational **S**tate **T**ransfer* é em principio um conjunto de seis "regras". Para que uma API seja *RESTfull* ela deve ser:

1. Uniforme em relação à Interface
2. Cliente-Servidor
3. Sem Estado
4. Cacheável
5. Em camadas
6. Opcionalmente, gerar código por demanda

Normalmente uma Web API em REST utiliza os verbos HTTP (GET, POST, PUT, PATCH, DELETE) à seu favor mas a arquitetura não o obriga a utilização dessa técnica.

## SOAP

A primeira arquitetura de APIs amplamente utilizada ***S**imple **O**bject **A**ccess **P**rotocol* ou SOAP é protocolo bem definido e estruturado para troca de mensagens entre aplicações via Web. O protocolo SOAP é rigido quanto a sua implementação e utilização, retirando várias escolhas do programador.

SOAP usa o formato XML para transferência de mensagens, e por esse motivo possui mensagens muito verboas. O protocolo não foi abandonado mas é muito pouco utilizado no dia a dia.

## Graph-QL

A novata do grupo, a arquitetura GraphQL surgiu com o objetivo de fornecer uma linguagem de consultas para APIs, ela se baseia fortemente no formato JSON e está começando a ser utilizada por ai.

Apesar de recente, inovadora e prometer mil maravilhas a arquitetura ainda não encontrou muita utilização pública, isso não significa que não tenha atraido algumas randes empresas, apenas não espere encontrar esse tipo de API em todos os cantos.

## SDKs e Bibliotecas

Finalmente, e de maneira controversa, a ideia de criar uma biblioteca que age como API não é uma ideia nova, mas e um formato que é bastante utilizado pelas APIs mais comums. Muitos não consideram a ideia de uma SDK ou biblioteca como API, por isso a controversia, mas para a maioria dos propósitos uma API pode ser implementada como uma biblioteca.

# TL;DR

- APIs são interfaces para comunicação entre códigos
- APIs foram essenciais para evolução da internet
- APIs permitem a ideia de software como serviço
- APIs podem ser implementadas de diversas maneiras

Por enquanto é só, teremos mais sobre APIs no futuro, mas até lá.

> *Happy Coding*
> ;D